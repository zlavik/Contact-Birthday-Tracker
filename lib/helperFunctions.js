const crypto = require('crypto');

function findDaysUntilBirthday(birthday) {
  let contactBdayMonth = birthday.getMonth();
  let contactBdayDay = birthday.getDate();

  let today = new Date();
  let bday = new Date(today.getFullYear(), contactBdayMonth, contactBdayDay);
  if (today.getMonth()==11 && today.getDate()>25) bday.setFullYear(bday.getFullYear()+1); 
  let oneDay = 1000*60*60*24;

  return Math.ceil((bday.getTime()-today.getTime())/(oneDay));
}


const generatePassword = (
  length = 20,
  wishlist = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@#$%^&*()_+-={}[]|\:;"<,>.?/' + "'"
) =>
  Array.from(crypto.randomFillSync(new Uint32Array(length)))
    .map((x) => wishlist[x % wishlist.length])
    .join('')


module.exports = {
  findDaysUntilBirthday,
  generatePassword
};