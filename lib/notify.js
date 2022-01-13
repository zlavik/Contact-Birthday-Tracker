const { sendMail } = require("./courier");
const { dbQuery } = require("./db-query");
const { findDaysUntilBirthday } = require("./helperFunctions")


// Gets alerts that have a reminder enabled
async function getTodaysAlerts() {
  const today = new Date(); 
  const GET_ALERTS = `SELECT c.firstName, c.LastName, c.birthday, c.dayReminder, c.weekReminder, c.monthReminder, u.username, u.email FROM contacts AS c` + 
                    ` INNER JOIN users AS u ON c.user_id = u.username` + 
                    ' WHERE c.dayreminder OR c.weekreminder OR c.monthreminder';

  let results = await dbQuery(GET_ALERTS);

  if (results.length === 0) return undefined;
  return results;
}

// checks for alerts and if there are any alerts
// checks if those birthdays are 1,7, or 30 days away from today
// If they are we send an email notification to the user that contact is set to.
async function queryAlerts() {
  const alerts = await getTodaysAlerts();
  if (!alerts) {
    console.log("No alerts today.");
  } else {
    alerts.rows.forEach(row => {
      let daysUntilBirthday = findDaysUntilBirthday(row.birthday);
      if (daysUntilBirthday === 1 && row.dayreminder || daysUntilBirthday === 7 && row.weekreminder || daysUntilBirthday === 30 && row.monthreminder ) {
        console.log('sent email..')
        sendMail(row, daysUntilBirthday);
      }
    });
  }
}

module.exports = {
  queryAlerts
};