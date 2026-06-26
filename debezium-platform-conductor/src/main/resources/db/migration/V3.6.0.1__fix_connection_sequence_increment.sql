alter sequence connection_seq increment by 50;

select setval(
       'connection_seq',
       coalesce((select max(id) from connection), 0) + 50,
       true
);