const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");
const saltRounds = 10;

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }
  
  // Returns a Promise that resolves to `true` if `username` and `password`
  // combine to identify a legitimate application user, `false` if either the
  // `username` or `password` is invalid.
  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users" +
                                 "  WHERE username = $1";

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }
  
  // checks if the username with the email provided exists
  async checkEmailExists(email) {
    const FIND_USER = 'SELECT email FROM users' +
                      ' WHERE email = $1';
    let result = await dbQuery(FIND_USER, email);
    return result.rowCount === 1;
  }

  async findUsername(email) {
    const FIND_USER = 'SELECT username FROM users' +
                      ' WHERE email = $1';
    let result = await dbQuery(FIND_USER, email);
    return result.rows[0];
  }

  // updates password for user
  async updatePassword(username, password) {
    let hashedPassword = bcrypt.hashSync(password, 10)
    const UPDATE_USER = "UPDATE users " + 
                        "SET password = $1 " + 
                        "WHERE username = $2";
    let result = await dbQuery(UPDATE_USER, hashedPassword, username);
    return result.rowCount > 0;
  }
  

  //Deletes account
  async deleteAccount(username) {
    const DELETE_USER = 'DELETE FROM users' +
                        ' WHERE username = $1';
    let result = await dbQuery(DELETE_USER, username);
    return result.rowCount > 0;
  }

  // Create a new contact with the specified info and add it to the indicated user
  // Returns `true` on success, `false` on failure.
  async createContact(firstName, lastName, birthday, category, phoneNumber, monthReminder, weekReminder, dayReminder) {
    const CREATE_CONTACT = "INSERT INTO contacts" +
                        "  (user_id, firstName, lastName, birthday, category, phoneNumber, monthReminder, weekReminder, dayReminder)" +
                        "  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)";

    let result = await dbQuery(CREATE_CONTACT, this.username, firstName, lastName, birthday, category, phoneNumber, monthReminder, weekReminder, dayReminder);
    
    return result.rowCount > 0;
  }

  // Updates an existing contact in the database
  // Returns `true` on success, `false` on failure.
  async updateContact(firstName, lastName, birthday, category, phoneNumber, contactId) {
    const UPDATE_CONTACT = "UPDATE contacts" +
                           "  SET firstName = $1, lastName = $2, birthday = $3, category = $4, phoneNumber = $5" +
                           "  WHERE id = $6 AND  user_id = $7";

    let result = await dbQuery(UPDATE_CONTACT, firstName, lastName, birthday, category, phoneNumber, contactId, this.username);
    return result.rowCount > 0;
  }

  async loadUser() {
    const FIND_USER = "SELECT * FROM users WHERE username = $1";
    let result = await dbQuery(FIND_USER, this.username);
    return result.rows[0];
  }

  async setReminderPreference(contactId, dayPref, weekPref, monthPref) {
    const UPDATE_PREFERENCE = 'UPDATE contacts' +
                              ' SET dayReminder = $1, weekReminder = $2, monthReminder = $3' + 
                              ' WHERE id = $4 AND user_id = $5';

    let result = await dbQuery(UPDATE_PREFERENCE, dayPref, weekPref, monthPref, contactId, this.username)
    return result.rowCount > 0;
  }

  async setReminderPreferenceAll(dayPref, weekPref, monthPref) {
    const UPDATE_PREFERENCE_ALL = 'UPDATE contacts' +
                              ' SET dayReminder = $1, weekReminder = $2, monthReminder = $3' + 
                              ' WHERE user_id = $4';
    const UPDATE_PREFERENCE_USER = 'UPDATE users' +
                              ' SET dayReminder = $1, weekReminder = $2, monthReminder = $3' + 
                              ' WHERE username = $4';
    await dbQuery(UPDATE_PREFERENCE_USER, dayPref, weekPref, monthPref, this.username)
    let result = await dbQuery(UPDATE_PREFERENCE_ALL, dayPref, weekPref, monthPref, this.username)
    return result.rowCount > 0;
  }

  async setReminderPreferenceFamily(dayPref, weekPref, monthPref) {
    const UPDATE_PREFERENCE_USER = 'UPDATE users' +
                              ' SET dayReminderFamily = $1, weekReminderFamily = $2, monthReminderFamily = $3' + 
                              ' WHERE username = $4';
    let result = await dbQuery(UPDATE_PREFERENCE_USER, dayPref, weekPref, monthPref, this.username)
    return result.rowCount > 0;
  }
  
  async setReminderPreferenceFriend(dayPref, weekPref, monthPref) {
    const UPDATE_PREFERENCE_USER = 'UPDATE users' +
                              ' SET dayReminderFriend = $1, weekReminderFriend = $2, monthReminderFriend = $3' + 
                              ' WHERE username = $4';
    let result = await dbQuery(UPDATE_PREFERENCE_USER, dayPref, weekPref, monthPref, this.username)
    return result.rowCount > 0;
  }
  
  async setReminderPreferenceAcquaintance(dayPref, weekPref, monthPref) {
    const UPDATE_PREFERENCE_USER = 'UPDATE users' +
                              ' SET dayreminderacquaintance = $1, weekReminderAcquaintance = $2, monthReminderAcquaintance = $3' + 
                              ' WHERE username = $4';
    let result = await dbQuery(UPDATE_PREFERENCE_USER, dayPref, weekPref, monthPref, this.username)
    return result.rowCount > 0;
  }
  
  async setReminderPreferenceOther(dayPref, weekPref, monthPref) {
    const UPDATE_PREFERENCE_USER = 'UPDATE users' +
                              ' SET dayReminderOther = $1, weekReminderOther = $2, monthReminderOther = $3' + 
                              ' WHERE username = $4';
    let result = await dbQuery(UPDATE_PREFERENCE_USER, dayPref, weekPref, monthPref, this.username)
    return result.rowCount > 0;
  }
  
  async setReminderPreferenceCoWorker(dayPref, weekPref, monthPref) {
    const UPDATE_PREFERENCE_USER = 'UPDATE users' +
                              ' SET dayReminderCoWorker = $1, weekReminderCoWorker = $2, monthReminderCoWorker = $3' + 
                              ' WHERE username = $4';
    let result = await dbQuery(UPDATE_PREFERENCE_USER, dayPref, weekPref, monthPref, this.username)
    return result.rowCount > 0;
  }
  // Adds a new user to the users lists
  async registerUser(username, password, email) {
    // Hashes and salts the password
    const salt = bcrypt.genSaltSync(saltRounds);
    const hashedPassword = bcrypt.hashSync(password, salt)
    const CREATE_USER = "INSERT INTO users" + 
                        "(username, password, email)" + 
                        "VALUES ($1, $2, $3)";
    let result = await dbQuery(CREATE_USER, username, hashedPassword, email);
    return result.rowCount > 0;
  }
  
  // checks if username exists in database
  async checkUserExists(username) {
    const GET_USER = "SELECT username FROM users" +
                     "  WHERE username = $1";

    let result = await dbQuery(GET_USER, username);
    return result.rowCount > 0;
  }

  // checks if email exists in database  
  async checkEmailExists(email) {
    const GET_USER = "SELECT email FROM users" +
                     "  WHERE email = $1";

    let result = await dbQuery(GET_USER, email);
    return result.rowCount > 0;
  }

  async removeTestReminder() {
    const REMOVE_TEST_REMINDER = "UPDATE users " + 
                                "SET testReminder = false " +
                                "WHERE username = $1";
    let result = await dbQuery(REMOVE_TEST_REMINDER, this.username);
  }

  // Returns a copy of the indicated contact from the indicated username. Returns
  // `undefined` if either the username or the contact is not found.
  async loadContact(contactId) {
    const FIND_CONTACTS = "SELECT * FROM contacts WHERE id = $1 AND user_id = $2";

    let result = await dbQuery(FIND_CONTACTS, contactId, this.username);
    return result.rows[0];
  }

  async loadContactForTest(contactId) {
    const FIND_CONTACT = `SELECT c.firstName, c.LastName, c.birthday, u.username, u.email FROM contacts AS c` + 
    ` INNER JOIN users AS u ON c.user_id = u.username` +
    ' WHERE c.id = $1 AND u.username = $2'

    let result = await dbQuery(FIND_CONTACT, contactId, this.username);
    return result.rows[0];
  }

  // Returns a promise that resolves to a sorted list of all the contacts 
  // The list is sorted by last name (case-insensitive).
  async sortedContacts() {
    const SORTED_CONTACTS = "SELECT * FROM contacts" +
                         "  WHERE user_id = $1" +
                         "  ORDER BY lower(lastName) ASC";

    let result = await dbQuery(SORTED_CONTACTS, this.username);

    return result.rows;
  }

  

  // Delete the specified contact from the specified user. Returns `true` on
  // success, `false` if the contact or user doesn't exist. 
  async deleteContact(contactId) {
    let DELETE_CONTACT = 'DELETE FROM contacts WHERE user_id = $1 AND id = $2';
    
    let result = await dbQuery(DELETE_CONTACT, this.username, contactId);
    return result.rowCount > 0;
  }
  
  clearSessionData(session) {
    delete session.email;
    delete session.username;
    delete session.signedin;
  }

  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

};