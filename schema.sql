DROP TABLE contacts;
DROP TABLE users;


CREATE TABLE users (
  username text PRIMARY KEY,
  password text NOT NULL,
  email text NOT NULL,
  monthReminder text DEFAULT false,
  weekReminder text DEFAULT false,
  dayReminder text DEFAULT false
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