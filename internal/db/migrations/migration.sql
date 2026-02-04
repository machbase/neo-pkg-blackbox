create tag table sensor3 (
    name varchar(128) primary key,
    time datetime basetime,
    value double summarized
) with rollup;

create tag table {camera} (
    name varchar(128) primary key,
    time datetime basetime,  -- 시작시간
    length double summarized, -- 삭제 예정
    value long  -- 몇초 
    chunk_path varchar(128)동영상 경로 (청크 경로)
) with rollup;

CREATE TAG TABLE {camera}_event (
    name                VARCHAR(128) PRIMARY KEY,  -- camera_id.rule_id
    time                DATETIME BASETIME,         -- tick_time
    value               DOUBLE,       -- 2/1/0/-1

    expression_text      VARCHAR(1024),
    used_counts_snapshot JSON, -- JSON
) METADATA (
    camera_id  VARCHAR(64),
    rule_id    VARCHAR(64),
);


CREATE TAG TABLE {camera}_log (
    name     VARCHAR(128) PRIMARY KEY,   -- camera_id.ident
    time     DATETIME BASETIME,          -- tick_time
    value    DOUBLE,                     -- count (차트/집계용)

    model_id VARCHAR(64) -- 현재 0 
)
METADATA (
    camera_id VARCHAR(64),
    ident     VARCHAR(64)
);

