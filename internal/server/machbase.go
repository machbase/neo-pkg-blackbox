package server

import (
	"blackbox-backend/internal/config"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type MachbaseHttpClient struct {
	enabled   bool
	baseURL   string
	timeout   time.Duration
	apiToken  string
	user      string
	password  string
	httpc     *http.Client
	userAgent string
}

type machbaseQueryResponse struct {
	Success bool   `json:"success"`
	Reason  string `json:"reason"`
	Data    struct {
		Columns []string        `json:"columns"`
		Rows    [][]interface{} `json:"rows"`
	} `json:"data"`
}

func NewMachbaseHttpClient(cfg config.MachbaseHTTPConfig) *MachbaseHttpClient {
	timeout := time.Duration(cfg.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	base := fmt.Sprintf("%s://%s:%d", cfg.Scheme, cfg.Host, cfg.Port)

	return &MachbaseHttpClient{
		enabled:   !cfg.Disabled,
		baseURL:   base,
		timeout:   timeout,
		apiToken:  cfg.APIToken,
		user:      cfg.User,
		password:  cfg.Password,
		httpc:     &http.Client{Timeout: timeout},
		userAgent: "blackbox-backend/1.0",
	}
}

func (c *MachbaseHttpClient) headers() http.Header {
	h := make(http.Header)
	h.Set("Accept", "application/json")
	h.Set("Content-Type", "application/x-www-form-urlencoded")
	h.Set("User-Agent", c.userAgent)

	if c.apiToken != "" {
		h.Set("X-Machbase-Api-Token", c.apiToken)
	}
	if c.user != "" && c.password != "" {
		cred := base64.StdEncoding.EncodeToString([]byte(c.user + ":" + c.password))
		h.Set("Authorization", "Basic "+cred)
	}
	return h
}

func (c *MachbaseHttpClient) postForm(ctx context.Context, path string, params url.Values) (*machbaseQueryResponse, error) {
	if !c.enabled {
		return nil, newApiError(503, "Machbase HTTP client disabled")
	}

	u := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(params.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header = c.headers()

	resp, err := c.httpc.Do(req)
	if err != nil {
		return nil, newApiError(503, fmt.Sprintf("Machbase HTTP connection failed: %v", err))
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, newApiError(resp.StatusCode, fmt.Sprintf("Machbase HTTP error: %s", resp.Status))
	}

	var out machbaseQueryResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, newApiError(502, "Invalid JSON from Machbase HTTP API")
	}
	if !out.Success {
		reason := out.Reason
		if reason == "" {
			reason = "Machbase query failed"
		}
		return nil, newApiError(500, reason)
	}
	return &out, nil
}

func (c *MachbaseHttpClient) Query(ctx context.Context, sql string, extra map[string]string) (*machbaseQueryResponse, error) {
	params := url.Values{}
	params.Set("q", sql)
	params.Set("format", "json")
	for k, v := range extra {
		params.Set(k, v)
	}

	if len(extra) > 0 {
		log.Printf("Machbase SQL: %s | extra_params=%v", sql, extra)
	} else {
		log.Printf("Machbase SQL: %s", sql)
	}

	return c.postForm(ctx, "/db/query", params)
}

func (c *MachbaseHttpClient) Select(ctx context.Context, sql string, extra map[string]string) ([]string, [][]interface{}, error) {
	r, err := c.Query(ctx, sql, extra)
	if err != nil {
		return nil, nil, err
	}
	return r.Data.Columns, r.Data.Rows, nil
}
