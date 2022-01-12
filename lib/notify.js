const { sendMail } = require("./courier");
const { dbQuery } = require("./db-query");


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

// removes a set amount of days from a date provided.
function removeDaysFromDate(days, date) {
  var result = new Date(date);
  result.setDate(result.getDate() - days);
  return result.toISOString().split('T')[0];
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
      let birthdayTomorrow = removeDaysFromDate(1, String(row.birthday))
      let birthdayNextWeek = removeDaysFromDate(7, String(row.birthday))
      let birthdayNextMonth= removeDaysFromDate(30, String(row.birthday))
      let today = new Date();
      let age = new Date().getFullYear() - row.birthday.getFullYear();
      today.setFullYear(today.getFullYear() - age);
      today = today.toISOString().split('T')[0];

      let daysUntilBirthday;
      if (birthdayTomorrow === today ) {
        daysUntilBirthday = 1;
      } else if (birthdayNextWeek === today) {
        daysUntilBirthday = 7;
      } else if (birthdayNextMonth === today) {
        daysUntilBirthday = 30;
      }

      if (birthdayTomorrow === today && row.dayreminder || birthdayNextWeek === today && row.weekreminder || birthdayNextMonth === today && row.monthreminder ) {
        console.log('sent email..')
        sendMail(row, daysUntilBirthday, age);
      }
    });
  }
}

module.exports = {
  queryAlerts
};