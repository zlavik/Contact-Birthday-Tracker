const config = require("./lib/config");
const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const { sendMail } = require("./lib/courier");
const { findDaysUntilBirthday } = require("./lib/helperFunctions")
const store = require("connect-loki");
const { CronJob } = require("cron");
const { queryAlerts } = require("./lib/notify");
const PgPersistence = require("./lib/pg-persistence");
const catchError = require("./lib/catch-error");


const app = express();
const host = 'localhost';
const port = '3000';
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
  return body(phoneNumber)
  .trim()
  .isLength({ min: 10 })
  .withMessage("Phone number is required.")
  .bail()
  .matches(/^\d\d\d-\d\d\d-\d\d\d\d$|^\d\d\d\d\d\d\d\d\d\d$/)
  .withMessage("Invalid phone number. Enter 10 digits in this format: ###-###-#### or ##########.");
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
  .isLength({ min: 3 })
  .withMessage("Username is required.")
  .isLength({ max: 20 })
  .withMessage(`Username is too long. Maximum length is 20 characters.`)
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
const validatePassword = (password, password2) => {
  return body(password)
    .trim()
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long.")
    .isLength({ max: 50 })
    .withMessage(`Password is too long. Maximum length is 50 characters.`)
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,'g')
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



app.get("/", (req, res) => {
  res.render("home", {
    signedIn : res.locals.signedIn,
  });
})

// Render the Sign In page.
app.get("/signin", (req, res) => {
  res.render("signin", {
    flash: req.flash(),
  });
});

// Render the register page.
app.get("/register", (req, res) => {
  res.render("register", {
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
      req.flash("error", "Invalid credentials.");
      res.render("signin", {
        flash: req.flash(),
        username: req.body.username,
      });
    } else {
      let session = req.session;
      session.username = username;
      session.signedIn = true;
      req.flash("info", "Welcome!");
      res.redirect("/contacts");
    }
  })
);

// Handle Register form submission
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
      req.flash("info", "Welcome!");
      res.redirect("/contacts");
    }
  })
);

// Handle Sign Out
app.post("/users/signout", (req, res) => {
  delete req.session.username;
  delete req.session.signedIn;
  res.redirect("/signin");
});

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

// Formats unformated phone number
const formatPhoneNumber = (number) => {
  return number.length === 12 ? number : [...String(number)].map((digit, idx) => {
    return idx === 3 || idx === 6 ? `-${digit}` : digit;
    }).join('');
}

const capitalizeName = (name) => name.charAt(0).toUpperCase() + name.slice(1);

// Handles adding a new contact
app.post("/contacts/new",
  requiresAuthentication,
  [
    validateName('firstName', "First"),
    validateName('lastName', "Last"),
    validatePhoneNumber('phoneNumber'),
    validateBirthday('birthday'),
    validateRelation('category')
  ],
  catchError(async (req, res) => {
    let errors = validationResult(req);

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
        let created = await res.locals.store.createContact(capitalizeName(req.body.firstName), 
                            capitalizeName(req.body.lastName), req.body.birthday, 
                            req.body.category, formatPhoneNumber(req.body.phoneNumber));
        if (!created) throw new Error("Not found.");
        req.flash("success", `${req.body.firstName} ${req.body.lastName} has been added to your contact list.`);
        res.redirect(`/contacts`);
    }
  })
);

// Render edit contact form
app.get("/contacts/:contactId/edit",
  catchError(async (req, res) => {
    let contactId = req.params.contactId;
    let contact = await res.locals.store.loadContact(+contactId);
    if (!contact) throw new Error("Not found.");

    res.render("edit-contact", { contact });
  })
);

// Edit contact
app.post("/contacts/:contactId/edit",
  requiresAuthentication,
  [
    validateName('firstName', "First"),
    validateName('lastName', "Last"),
    validatePhoneNumber('phoneNumber'),
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

// Delete contact
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
)

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
        req.flash("success", "Email maybe sent. Check your inbox.");
        res.redirect("/contacts");
      } else {
        req.flash("error", "Cannot send more than one test messages per account!");
        res.redirect("/contacts");
      }
      await res.locals.store.removeTestReminder();
      if (!contact) throw new Error("Error");

    })

)

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
)

// Handles editing preferences for all contacts
app.post(`/setting/edit`, 
    requiresAuthentication,
    catchError(async (req, res, next) => {
      let dayPref = !!req.body.day ? true : false;
      let weekPref = !!req.body.week ? true : false;
      let monthPref = !!req.body.month ? true : false;
      let reminderPreferenceSetAll = await res.locals.store.setReminderPreferenceAll(dayPref, weekPref, monthPref);
      if (!reminderPreferenceSetAll) throw new Error("Error");
      req.flash("success", "Preference set set for all contacts successfully");
      res.redirect("/contacts");
    })
)

// renders setting page
app.get("/setting", 
  requiresAuthentication,
  catchError(async (req, res) => {
    let userInfo = await res.locals.store.loadUser();
    if (!userInfo) throw new Error("Not found.");
    res.render("edit-user", { userInfo });
  })
)

// gets daily alerts at 8 am PST.
const getDailyAlerts = new CronJob(
  '00 08 * * *',
  queryAlerts,
  null,
  false,
  'America/Los_Angeles',
);
// sends alerts at 8am every day.
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
