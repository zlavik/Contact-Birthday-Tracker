DROP TABLE contacts;
DROP TABLE users;


CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL,
  email text NOT NULL,
  monthReminder boolean DEFAULT false,
  weekReminder boolean DEFAULT false,
  dayReminder boolean DEFAULT false,
  testReminder boolean DEFAULT true,

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

-- ALTER TABLE users
--   ADD   weekReminderFamily boolean DEFAULT false,
--   ADD   dayReminderFamily boolean DEFAULT false,

--   ADD   monthReminderFriend boolean DEFAULT false,
--   ADD   weekReminderFriend boolean DEFAULT false,
--   ADD   dayReminderFriend boolean DEFAULT false, 

--   ADD   monthReminderCoWorker boolean DEFAULT false,
--   ADD   weekReminderCoWorker boolean DEFAULT false,
--   ADD   dayReminderCoWorker boolean DEFAULT false,

--   ADD   monthReminderAcquaintance boolean DEFAULT false,
--   ADD   weekReminderAcquaintance boolean DEFAULT false,
--   ADD   dayReminderAcquaintance boolean DEFAULT false,

--   ADD   monthReminderOther boolean DEFAULT false,
--   ADD   weekReminderOther boolean DEFAULT false,
--   ADD   dayReminderOther boolean DEFAULT false;   

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