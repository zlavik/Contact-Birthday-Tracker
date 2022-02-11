const config = require('./config');
const { CourierClient } = require("@trycourier/courier");


// Creates a courier client
const courier = CourierClient({ authorizationToken: config.COURIER_ACCESS_TOKEN });


async function sendTempPassword(username, email, password) {
  const { messageId } = await courier.send({
    brand: config.COURIER_BRAND,
    eventId: config.RESET_PASSWORD_EVENT_ID,
    recipientId: `${username}`,
    profile: {
      email: `${email}`,
    },
    data: {
      tempPassword: password,
    },
    override: {
    },
  }).catch((error) => {console.error(error)});
}

// creates a function that lets us send emails
async function sendMail(alertObject, daysUntilBirthday) {

  let msg = '';
  if (daysUntilBirthday < 0) {
    msg = `in ${daysUntilBirthday + 365} days`;
  } else if (daysUntilBirthday > 0) {
    msg = `${daysUntilBirthday === 1 ? '' : 'in'}${daysUntilBirthday === 1 ? '' : ` ${daysUntilBirthday} `}${daysUntilBirthday === 1 ? 'tomorrow!' : 'days'}`;
  } else {
    msg = 'today'
  }

  const { messageId } = await courier.send({
    brand: config.COURIER_BRAND,
    eventId: config.COURIER_EVENT_ID,
    recipientId: `${alertObject.username}`,
    profile: {
      email: `${alertObject.email}`,
    },
    data: {
      fullname:`${alertObject.firstname[0].toUpperCase() + alertObject.firstname.slice(1).toLowerCase()} ${alertObject.lastname[0] + alertObject.lastname.slice(1).toLowerCase()}`,
      msg,
    },
    override: {
    },
  }).catch((error) => {console.error(error)});
}


module.exports = {
  sendMail,
  sendTempPassword
};