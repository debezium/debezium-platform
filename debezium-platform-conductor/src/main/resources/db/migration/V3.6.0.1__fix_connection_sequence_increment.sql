alter sequence connection_seq increment by 50;

do $$
declare
    max_connection_id bigint;
begin
    select max(id) into max_connection_id from connection;

    if max_connection_id is null then
            perform setval('connection_seq', 1, false);
    else
            perform setval('connection_seq', max_connection_id + 50, true);
    end if;
end $$;