-- DBZ-1245 Add description field to connection table
alter table if exists connection add column description varchar(255);
