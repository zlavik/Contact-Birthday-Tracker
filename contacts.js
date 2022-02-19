const config = require("./lib/config");
const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const { sendMail, sendTempPassword } = require("./lib/courier");
const { findDaysUntilBirthday,
        generatePassword,
        formatPhoneNumber,
        capitalizeName } = require("./lib/helperFunctions")
const store = require("connect-loki");
const { CronJob } = require("cron");
const { queryAlerts } = require("./lib/notify");
const PgPersistence = require("./lib/pg-persistence");
const catchError = require("./lib/catch-error");
const crypto = require('crypto');


const app = express();
const host = config.HOST;
const port = config.PORT;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "contacts app",
  resave: false,
  saveUninitialized: true,
  secret: config.SECRET,
  store: new LokiStore({}),
}));

app.use(flash());

// create a new datastore
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

// Extract session info
app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Validations
const validateName = (name, whichName) => {
  return body(name)
    .trim()
    .isLength({ min: 1 })
    .withMessage(`${whichName} name is required.`)
    .bail()
    .isLength({ max: 25 })
    .withMessage(`${whichName} name is too long. Maximum length is 25 characters.`)
    .isAlpha()
    .withMessage(`${whichName} name contains invalid characters. The name must be alphabetic.`);
};
const validateBirthday = (birthday) => {
  return body(birthday)
  .trim()
  .isLength({ min: 1 })
  .withMessage("Date of birth is required.");
}
const validatePhoneNumber = (phoneNumber) => {
  if (phoneNumber) {
    return body(phoneNumber)
    .trim()
    .isLength({ min: 10 })
    .withMessage("Phone number is required.")
    .bail()
    .matches(/^\d\d\d-\d\d\d-\d\d\d\d$|^\d\d\d\d\d\d\d\d\d\d$/)
    .withMessage("Invalid phone number. Enter 10 digits in this format: ###-###-#### or ##########.");
  } else {
    return '';
  }

}
const validateRelation = (relationship) => {
  return body(relationship)
  .trim()
  .isLength({ min: 3 })
  .withMessage("Relationship is required.");
}
const validateUsername = (username) => {
  return body(username)
  .trim()
  .isLength({ min: 5 })
  .withMessage("Username is too short. Must be at least 5 characters.")
  .isLength({ max: 20 })
  .withMessage(`Username is too long. Maximum length is 20 characters.`)
  .matches(/^[a-zA-Z0-9]([._-](?![._-])|[a-zA-Z0-9]){3,18}[a-zA-Z0-9]$/,'g')
  .withMessage("Enter a valid username.");
}
const validateEmail = (email) => {
  return body(email)
  .trim()
  .isLength({ min: 6 })
  .withMessage("Email is required.")
  .bail()
  .matches(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)
  .withMessage("Enter a valid email address.");
}
const validatePassword = (password) => {
  return body(password)
    .trim()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long.")
    .isLength({ max: 50 })
    .withMessage(`Password is too long. Maximum length is 50 characters.`)
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*\_\-\+\=\[\]\{\}\\\|;:'",.<>\?/])/,'g')
    .withMessage("Password must contain a lowercase, uppercase, number, and a special character")

}

// Detect unauthorized access to routes.
const requiresAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    res.redirect(302, "/signin");
  } else {
    next();
  }
};

//Render home page
app.get("/", (req, res) => {
  res.render("home", {
    signedIn : res.locals.signedIn,
  });
});

// Renders the Sign In page.
app.get("/signin", (req, res) => {
  res.render("signin", {
    flash: req.flash(),
  });
});

// Handle Sign In form submission
app.post("/signin",
  catchError(async (req, res) => {
    let username = req.body.username.trim();
    let password = req.body.password;

    let authenticated = await res.locals.store.authenticate(username, password);
    if (!authenticated) {
      req.flash("error", "Invalid Username or Password.");
      res.render("signin", {
        flash: req.flash(),
        username: req.body.username,
      });
    } else {
      let session = req.session;
      session.username = username;
      session.signedIn = true;
      res.redirect("/contacts");
    }
  })
);

// Handles forgot password
app.post(`/forgotpassword`,
  catchError(async (req, res) => {
    let email = req.body.email.trim();
    let tempPassword = generatePassword();
    let validUser = await res.locals.store.checkEmailExists(email);
    let username = await res.locals.store.findUsername(email);
    req.flash("info", "If the information provided is correct, you should receive an email with a temporary password.");
    if (validUser) {
      await res.locals.store.updatePassword(username.username, tempPassword);
      sendTempPassword(username.username, email, tempPassword);
      res.redirect("/");
    } else {
      res.redirect("/");
    }
  })
);

// Renders register page.
app.get("/register", (req, res) => {
  res.render("register", {
    flash: req.flash(),
  });
});

// Handles Register form submission
app.post("/register",
  [
    validatePassword('password', 'password2'),
    validateUsername('username'),
    validateEmail('email'),
  ],
  catchError(async (req, res) => {
    let errors = validationResult(req);
    let username = req.body.username.trim();
    let email = req.body.email.trim();
    let password = req.body.password.trim();
    let password2 = req.body.password2.trim();
    let userExists = await res.locals.store.checkUserExists(username);
    let emailExists = await res.locals.store.checkEmailExists(email);
    
    const rerenderRegister = () => {
      res.render("register", {
        flash: req.flash(),
        username,
        email,
        password
      });
    };
    
    if (!errors.isEmpty() || password !== password2 || userExists || emailExists) {
      errors.array().forEach(message => req.flash("error", message.msg));
      if (password !== password2) req.flash('error', 'Passwords must match');
      if (userExists) req.flash('error', 'Username is taken');
      if (emailExists) req.flash('error', 'Email is taken');
      rerenderRegister();
    } else {
      await res.locals.store.registerUser(username, password, email);
      let session = req.session;
      session.username = username;
      session.signedIn = true;
      res.redirect("/contacts");
    }
  })
);

// Renders contact page
app.get("/contacts",
  requiresAuthentication,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let contacts = await store.sortedContacts();
    res.render("contacts", {
      contacts,
      signedIn : res.locals.signedIn
    });
  })
);

// Renders new contact page
app.get("/contacts/new", (req, res) => {
  res.render("new-contact");
});

// Handles adding a new contact
app.post("/contacts/new",
  requiresAuthentication,
  [
    validateName('firstName', "First"),
    validateName('lastName', "Last"),
    validateBirthday('birthday'),
    validateRelation('category')
  ],
  catchError(async (req, res) => {
    let errors = validationResult(req);
    let monthReminder = false;
    let weekReminder = false;
    let dayReminder = false;

    const rerenderNewList = () => {
      res.render("new-contact", {
        flash: req.flash(),
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        birthday: req.body.birthday,
        relationship: req.body.category,
        phoneNumber: formatPhoneNumber(req.body.phoneNumber),
      });
    };
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      rerenderNewList();
    } else {
        let userInfo = await res.locals.store.loadUser();

        switch (req.body.category) {
          case 'Family' :
            monthReminder = userInfo.monthreminderfamily;
            weekReminder = userInfo.weekreminderfamily;
            dayReminder = userInfo.dayreminderfamily;
            break;
          case 'Friend' :
            monthReminder = userInfo.monthreminderfriend;
            weekReminder = userInfo.weekreminderfriend;
            dayReminder = userInfo.dayreminderfriend;
            break;
          case 'Co-Worker' :
            monthReminder = userInfo.monthremindercoworker;
            weekReminder = userInfo.weekremindercoworker;
            dayReminder = userInfo.dayremindercoworker;
            break;
          case 'Acquaintance' :
            monthReminder = userInfo.monthreminderacquaintance;
            weekReminder = userInfo.weekreminderacquaintance;
            dayReminder = userInfo.dayreminderacquaintance;
            break;
          case 'Other' :
            monthReminder = userInfo.monthreminderother;
            weekReminder = userInfo.weekreminderother;
            dayReminder = userInfo.dayreminderother;
            break;
          default :
            monthReminder = false;
            weekReminder = false;
            dayReminder = false;
        }
        console.log(monthReminder)
        let created = await res.locals.store.createContact(capitalizeName(req.body.firstName), 
                            capitalizeName(req.body.lastName), req.body.birthday, 
                            req.body.category, formatPhoneNumber(req.body.phoneNumber), monthReminder, weekReminder, dayReminder);
        if (!created) throw new Error("Not found.");
        req.flash("success", `${req.body.firstName} ${req.body.lastName} has been added to your contact list.`);
        res.redirect(`/contacts`);
    }
  })
);

// Renders edit contact form
app.get("/contacts/:contactId/edit",
  catchError(async (req, res) => {
    let contactId = req.params.contactId;
    let contact = await res.locals.store.loadContact(+contactId);
    if (!contact) throw new Error("Not found.");

    res.render("edit-contact", { contact });
  })
);

// Handles editing a contact
app.post("/contacts/:contactId/edit",
  requiresAuthentication,
  [
    validateName('firstName', "First"),
    validateName('lastName', "Last"),
    // validatePhoneNumber('phoneNumber'),
    validateBirthday('birthday'),
    validateRelation('category')
  ],
  catchError(async(req, res) => {
    let store = res.locals.store;
    let contactId = req.params.contactId;


    const rerenderEditList = async () => {
      let contact = await store.loadContact(+contactId);
      if (!contact) throw new Error("Not found.");
      
      res.render("edit-contact", {
        contact,
        flash: req.flash(),
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        birthday: req.body.birthday,
        relationship: req.body.category,
        phoneNumber: formatPhoneNumber(req.body.phoneNumber),
      });
    };

    try {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        rerenderEditList();
      } else {
        let updatedContact = await store.updateContact(capitalizeName(req.body.firstName), capitalizeName(req.body.lastName), 
                                    req.body.birthday, req.body.category, 
                                    formatPhoneNumber(req.body.phoneNumber), +contactId);
        if (!updatedContact) throw new Error("Not found.");

        req.flash("success", "Contact updated.");
        res.redirect(`/contacts`);
      }
    } catch (error) {
      if (store.isUniqueConstraintViolation(error)) {
        req.flash("error", "The contact must be unique.");
        rerenderEditList();
      } else {
        throw error;
      }
    }
  })
);

// Handles deleting a contact
app.post("/contacts/:contactID/destroy",
  requiresAuthentication,
  catchError(async (req, res, next) => {
    let contactId = +req.params.contactID;
    let deleted = await res.locals.store.deleteContact(+contactId);
    if (!deleted) throw new Error("Not found.");
    req.flash("success", "Contact deleted.");
    res.redirect("/contacts");
    }
  )
);

// handles setting reminder for selected contact
app.post(`/contacts/:contactID/setReminder`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let contactId = +req.params.contactID;
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;

      let reminderPreferenceSet = await res.locals.store.setReminderPreference(+contactId, dayPref, weekPref, monthPref);
      if (!reminderPreferenceSet) throw new Error("Error");
      req.flash("success", "Preference set set successfully");
      res.redirect("/contacts");
    })
);



// handles sending a test reminder for testing purposes
app.post('/contacts/:contactID/sendTestReminder', 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let contactId = +req.params.contactID;
      let contact = await res.locals.store.loadContactForTest(+contactId);
      let user = await res.locals.store.loadUser();
      let daysUntilBirthday = findDaysUntilBirthday(contact.birthday);

      if (user.testreminder) {
        sendMail(contact, daysUntilBirthday);
        req.flash("success", "Email sent! Check your inbox.");
        res.redirect("/contacts");
      } else {
        req.flash("error", "Cannot send more than one test messages per account!");
        res.redirect("/contacts");
      }
      await res.locals.store.removeTestReminder();
      if (!contact) throw new Error("Error");

    })

);

// renders contact reminder page
app.get("/contacts/:contactID/reminder", 
  requiresAuthentication,
  catchError(async (req, res) => {
    let contactId = +req.params.contactID;
    let contact = await res.locals.store.loadContact(+contactId);
    let user = await res.locals.store.loadUser();
    if (!contact) throw new Error("Not found.");
    res.render("reminder", { 
      contact,
      user
     });
  })
);

// renders setting page
app.get("/setting", 
  requiresAuthentication,
  catchError(async (req, res) => {
    let userInfo = await res.locals.store.loadUser();
    if (!userInfo) throw new Error("Not found.");
    res.render("edit-user", { userInfo });
  })
);

// Handles resetting password
app.post("/password-reset",
  requiresAuthentication,
  [
    validatePassword('newPassword'),
  ],
  catchError(async (req, res) => {
    let errors = validationResult(req);
    let currentPassword = req.body.currentPassword;
    let username = res.locals.username;
    let newPassword = req.body.newPassword;
    let newPasswordConfirm = req.body.newPasswordConfirm;

    let validCurrentPassword = await res.locals.store.authenticate(username, currentPassword);
    let validNewPassword = newPassword === newPasswordConfirm;
    console.log(username)
    if (!errors.isEmpty() || !validCurrentPassword || !validNewPassword) {
      errors.array().forEach(message => req.flash("error", message.msg));
      if (!validCurrentPassword) req.flash("error", "Current password does not match our records!");
      if (!validNewPassword) req.flash('error', 'Passwords must match');
      res.redirect("/setting");
    } else {
      await res.locals.store.updatePassword(username, newPassword);
      req.flash("success", "Password has been updated successfully!");
      res.redirect("/contacts");
    }

  })
);

// Handles editing preferences for all contacts
app.post(`/setting/preferenceAll`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;
      let reminderPreferenceSetAll = await res.locals.store.setReminderPreferenceAll(dayPref, weekPref, monthPref);
      if (!reminderPreferenceSetAll) throw new Error("Error");
      req.flash("success", "Preference set set for all contacts successfully");
      res.redirect("/setting");
    })
);

// Handles setting preferences for Family contacts
app.post(`/setting/preferenceFamily`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;
      let reminderPreferenceFamily = await res.locals.store.setReminderPreferenceFamily(dayPref, weekPref, monthPref);
      if (!reminderPreferenceFamily) throw new Error("Error");
      req.flash("success", "Preference set set for all contacts successfully");
      res.redirect("/setting");
    })
);

// Handles setting preferences for friend contacts
app.post(`/setting/preferenceFriend`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;
      let reminderPreferenceFriend = await res.locals.store.setReminderPreferenceFriend(dayPref, weekPref, monthPref);
      if (!reminderPreferenceFriend) throw new Error("Error");
      req.flash("success", "Preference set set for all contacts successfully");
      res.redirect("/setting");
    })
);

// Handles setting preferences for CoWorker contacts
app.post(`/setting/preferenceCoWorker`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;
      let reminderPreferenceCoWorker = await res.locals.store.setReminderPreferenceCoWorker(dayPref, weekPref, monthPref);
      if (!reminderPreferenceCoWorker) throw new Error("Error");
      req.flash("success", "Preference set set for all contacts successfully");
      res.redirect("/setting");
    })
);

// Handles setting preferences for Acquaintance contacts
app.post(`/setting/preferenceAcquaintance`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;
      let reminderPreferenceAcquaintance = await res.locals.store.setReminderPreferenceAcquaintance(dayPref, weekPref, monthPref);
      if (!reminderPreferenceAcquaintance) throw new Error("Error");
      req.flash("success", "Preference set set for all contacts successfully");
      res.redirect("/setting");
    })
);

// Handles setting preferences for Other contacts
app.post(`/setting/preferenceOther`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;
      let reminderPreferenceOther = await res.locals.store.setReminderPreferenceOther(dayPref, weekPref, monthPref);
      if (!reminderPreferenceOther) throw new Error("Error");
      req.flash("success", "Preference set set for all contacts successfully");
      res.redirect("/setting");
    })
);

// Handles deleting account
app.post('/account-delete', 
  requiresAuthentication,
  catchError(async (req, res) => {
    let username = req.body.username.trim();
    let password = req.body.password;
    let acknowledged = req.body.acknowledge;
    let validUser = await res.locals.store.authenticate(username, password);

    if (acknowledged && validUser) {
      await res.locals.store.deleteAccount(username);
      delete req.session.username;
      delete req.session.signedIn;
      req.flash('success', 'Account deleted!');
      res.redirect("/");
    } else {
      if (!validUser) req.flash('error', 'Incorrect user information');
      if (!acknowledged) req.flash('error', 'Must acknowledge by clicking on "Yes I want to delete my account"');
      res.redirect("/setting");     
    }
  })
) 

// Handle Sign Out
app.post("/users/signout", (req, res) => {
  delete req.session.username;
  delete req.session.signedIn;
  res.redirect("/signin");
});

// gets daily alerts at 8 am PST.
const getDailyAlerts = new CronJob(
  '00 08 * * *',
  queryAlerts,
  null,
  false,
  'America/Los_Angeles',
);
// Sends alerts at 8am every day.
getDailyAlerts.start();

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`Contact App is listening on port ${port} of ${host}!`);
});
