package server

import (
	"blackbox-backend/internal/config"
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

type Server struct {
	cfg        config.ServerConfig
	engine     *gin.Engine
	httpServer *http.Server
	data       *DataService
}

func New(cfg config.ServerConfig) (*Server, error) {
	cfg.ApplyDefaults()

	if cfg.Addr == "" {
		cfg.Addr = "0.0.0.0:8000"
	}
	if cfg.BaseDir == "" {
		exe, err := os.Executable()
		if err != nil {
			return nil, err
		}
		cfg.BaseDir = filepath.Dir(exe)
	}
	if cfg.DataPath == "" {
		cfg.DataPath = "/data"
	}

	httpc := NewMachbaseHttpClient(cfg.Machbase)
	ds := NewDataService(cfg.BaseDir, cfg.DataPath, httpc)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	s := &Server{cfg: cfg, engine: r, data: ds}
	s.registerRoutes()

	s.httpServer = &http.Server{
		Addr:         cfg.Addr,
		Handler:      s.engine,
		ReadTimeout:  cfg.ReadTimeout(),
		WriteTimeout: cfg.WriteTimeout(),
	}

	return s, nil
}

func (s *Server) registerRoutes() {
	api := s.engine.Group("/api")
	{
		api.GET("/cameras", s.handleCameras)
		api.GET("/get_time_range", s.handleTimeRange)
		api.GET("/get_chunk_info", s.handleChunkInfo)
		api.GET("/v_get_chunk", s.handleGetChunk)
		api.GET("/get_camera_rollup_info", s.handleCameraRollup)

		api.GET("/sensors", s.handleSensors)
		api.GET("/sensor_data", s.handleSensorData)
	}

	// Python SimpleHTTPRequestHandler 대응: 정적 파일 루트
	s.engine.StaticFS("/", http.Dir(s.cfg.BaseDir))
}

func (s *Server) Run(ctx context.Context) error {
	ln, err := net.Listen("tcp", s.cfg.Addr)
	if err != nil {
		return err
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("Serving on http://%s", s.cfg.Addr)
		if e := s.httpServer.Serve(ln); e != nil && !errors.Is(e, http.ErrServerClosed) {
			errCh <- e
			return
		}
		errCh <- nil
	}()

	select {
	case <-ctx.Done():
		sdCtx, cancel := context.WithTimeout(context.Background(), s.cfg.ShutdownTimeout())
		defer cancel()
		_ = s.Shutdown(sdCtx)
		return nil
	case e := <-errCh:
		return e
	}
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) writeError(c *gin.Context, err error) {
	var ae *ApiError
	if errors.As(err, &ae) {
		c.JSON(ae.Status, gin.H{"error": ae.Message})
		return
	}
	c.JSON(500, gin.H{"error": "Internal server error"})
}

func (s *Server) requireQuery(c *gin.Context, key string) (string, *ApiError) {
	v := strings.TrimSpace(c.Query(key))
	if v == "" {
		return "", newApiError(400, "Missing required parameter '"+key+"'")
	}
	return v, nil
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Machbase-Api-Token, Authorization")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.Status(http.StatusOK)
			c.Abort()
			return
		}
		c.Next()
	}
}
