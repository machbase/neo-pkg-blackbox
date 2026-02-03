create tag table blackbox3 (name varchar(128) primary key, time datetime basetime, length double summarized, value long)
    METADATA (prefix varchar(64), fps integer )  with rollup;
insert into blackbox3 metadata values('camera-0', 'chunk-stream', 15);

create tag table sensor3 (name varchar(128) primary key, time datetime basetime, value double summarized) with rollup;


CREATE TABLE stream_config_log (
    table_name      VARCHAR(128),      
    name            VARCHAR(128),     
    desc            TEXT,             
    rtsp_url        VARCHAR(2048),
    webrtc_url      VARCHAR(2048),
    ffmpeg_options  JSON              -- 32KB 이하면 JSON 추천, 더 크면 TEXT 고려
);