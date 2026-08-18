DROP TABLE IF EXISTS vote_events;
DROP TABLE IF EXISTS vote_totals;

CREATE TABLE vote_totals (
  choice TEXT PRIMARY KEY CHECK (choice IN ('increase', 'decrease')),
  count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO vote_totals (choice, count) VALUES ('increase', 247625), ('decrease', 215603);

CREATE TABLE vote_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('increase', 'decrease')),
  ip_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX vote_events_voter_time ON vote_events (voter_id, created_at);
