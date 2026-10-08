-- Complete dictation transcripts for the deployed TaskManager.
--
-- Run this once in the Neon SQL editor for the database that DATABASE_URL
-- points to. It is safe to run again. The app never creates this table.
--
-- It only adds a table. It does not change or remove anything that exists:
-- not dictation_activity, and not dictation_transcripts, the table an earlier
-- version of the app filled with one row per final result. That table is no
-- longer written to, and its rows are left as they are.
--
-- Each row here is the whole of what Speechmatics finally recognised in one
-- dictation session: the text, the session's random identifier, the testing
-- label of the browser it came from (PUBLIC when none was set), and when the
-- server received it. Interim results and audio are never stored.

create table if not exists dictation_session_transcripts (
    session_id uuid primary key,
    user_label text not null check (user_label ~ '^[A-Za-z0-9_-]{1,20}$'),
    transcript text not null check (char_length(transcript) between 1 and 4000),
    occurred_at timestamptz not null default now()
);

create index if not exists dictation_session_transcripts_occurred_at_idx
    on dictation_session_transcripts (occurred_at desc);
