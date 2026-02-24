package config

type MediamtxConfig struct {
	Binary string `yaml:"binary"` // MediaMTX 바이너리 경로 (비어있으면 외부 서버 사용)
	Host   string `yaml:"host"`   // MediaMTX 서버 호스트
	Port   int    `yaml:"port"`   // MediaMTX HTTP API 포트 (기본: 9997)
}

// ApplyDefaults sets default values for MediamtxConfig
func (c *MediamtxConfig) ApplyDefaults() {
	if c.Host == "" {
		c.Host = "127.0.0.1"
	}
	if c.Port == 0 {
		c.Port = 9997
	}
}
