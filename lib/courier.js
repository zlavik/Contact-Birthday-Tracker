const config = require('./config');
const { CourierClient } = require("@trycourier/courier");

// Creates a courier client
const courier = CourierClient({ authorizationToken: config.COURIER_ACCESS_TOKEN });

// creates a function that lets us send emails
function sendMail(alertObject, daysUntilBirthday, age) {
  console.log(alertObject, daysUntilBirthday, age);

  let msg = `${daysUntilBirthday === 1 ? '' : 'in'}${daysUntilBirthday === 1 ? '' : ` ${daysUntilBirthday} `}${daysUntilBirthday === 1 ? 'tomorrow!' : 'days'}`;
  courier.send({
    brand: config.COURIER_BRAND,
    eventId: config.COURIER_EVENT_ID,
    recipientId: config.COURIER_RECIPIENT_ID,
    profile: {
      email: `${alertObject.email}`,
    },
    data: {
      name:`${alertObject.firstname[0].toUpperCase() + alertObject.firstname.slice(1)} ${alertObject.lastname[0] + alertObject.lastname.slice(1)}`,
      birthdayMsg: msg,
      age,
    },
    override: {
    },
  }).catch((error) => {console.error(error)});
}


module.exports = {
  sendMail
};