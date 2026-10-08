-- Dictation activity for the deployed TaskManager.
--
-- Run this once in the Neon SQL editor for the database that DATABASE_URL
-- points to. It is safe to run again. The app never creates this table.
--
-- Each row records that a dictation event happened: which event, the testing
-- label of the browser it came from (PUBLIC when none was set), and when.
-- Nothing else is stored.

create table if not exists dictation_activity (
    id bigint generated always as identity primary key,
    event text not null check (
        event in (
            'dictation_started',
            'dictation_transcript_received',
            'dictation_completed',
            'dictation_failed'
        )
    ),
    user_label text not null check (user_label ~ '^[A-Za-z0-9_-]{1,20}$'),
    occurred_at timestamptz not null default now()
);

create index if not exists dictation_activity_occurred_at_idx
    on dictation_activity (occurred_at desc);
