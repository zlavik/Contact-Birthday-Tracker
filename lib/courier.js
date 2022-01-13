const config = require('./config');
const { CourierClient } = require("@trycourier/courier");



// Creates a courier client
const courier = CourierClient({ authorizationToken: config.COURIER_ACCESS_TOKEN });

// creates a function that lets us send emails
async function sendMail(alertObject, daysUntilBirthday, age) {
  let msg = `${daysUntilBirthday === 1 ? '' : 'in'}${daysUntilBirthday === 1 ? '' : ` ${daysUntilBirthday} `}${daysUntilBirthday === 1 ? 'tomorrow!' : 'days'}`;

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
      firstName: `${alertObject.firstname[0].toUpperCase() + alertObject.firstname.slice(1).toLowerCase()}`,
      age
    },
    override: {
    },
  }).catch((error) => {console.error(error)});

  // const messageStatus = await courier.getMessage(messageId).catch((error) => {console.error(error)});;
  // console.log(messageStatus);
}


module.exports = {
  sendMail
};