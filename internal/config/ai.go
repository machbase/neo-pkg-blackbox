package config

// AIConfig는 AI manager 프로세스 설정
type AIConfig struct {
	Binary     string `yaml:"binary"`      // manager 바이너리 경로 (비어있으면 비활성화)
	ConfigFile string `yaml:"config_file"` // config.json 경로
}
