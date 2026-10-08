-- Final dictation transcripts for the deployed TaskManager.
--
-- Run this once in the Neon SQL editor for the database that DATABASE_URL
-- points to. It is safe to run again, and does not change the existing
-- dictation_activity table. The app never creates this table.
--
-- Each row is one final result that Speechmatics recognised: the text, the
-- dictation session it belongs to and its position in that session, the
-- testing label of the browser it came from (PUBLIC when none was set), and
-- when the server received it. Interim results and audio are never stored.

create table if not exists dictation_transcripts (
    id bigint generated always as identity primary key,
    session_id uuid not null,
    sequence integer not null check (sequence between 1 and 10000),
    user_label text not null check (user_label ~ '^[A-Za-z0-9_-]{1,20}$'),
    transcript text not null check (char_length(transcript) between 1 and 1000),
    occurred_at timestamptz not null default now(),
    unique (session_id, sequence)
);

create index if not exists dictation_transcripts_occurred_at_idx
    on dictation_transcripts (occurred_at desc);
