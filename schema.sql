DROP TABLE contacts;
DROP TABLE users;


CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL,
  email text NOT NULL,

  testReminder boolean DEFAULT true,

  monthReminder boolean DEFAULT false,
  weekReminder boolean DEFAULT false,
  dayReminder boolean DEFAULT false,

  monthReminderFamily boolean DEFAULT false,
  weekReminderFamily boolean DEFAULT false,
  dayReminderFamily boolean DEFAULT false,

  monthReminderFriend boolean DEFAULT false,
  weekReminderFriend boolean DEFAULT false,
  dayReminderFriend boolean DEFAULT false, 

  monthReminderCoWorker boolean DEFAULT false,
  weekReminderCoWorker boolean DEFAULT false,
  dayReminderCoWorker boolean DEFAULT false,

  monthReminderAcquaintance boolean DEFAULT false,
  weekReminderAcquaintance boolean DEFAULT false,
  dayReminderAcquaintance boolean DEFAULT false,

  monthReminderOther boolean DEFAULT false,
  weekReminderOther boolean DEFAULT false,
  dayReminderOther boolean DEFAULT false    
);

CREATE TABLE contacts (
  id serial PRIMARY KEY,
  firstName text NOT NULL,
  lastName text NOT NULL,
  birthday date NOT NULL,
  phoneNumber text NOT NULL,
  category text NOT NULL,
  monthReminder boolean DEFAULT false,
  weekReminder boolean DEFAULT false,
  dayReminder boolean DEFAULT false,
  user_id text
    NOT NULL
    REFERENCES users (username)
    ON DELETE CASCADE
);