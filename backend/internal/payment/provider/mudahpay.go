package provider

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/payment"
)

const (
	mudahPayDefaultAPIBase   = "https://api.mudahpay.my.id"
	mudahPayDefaultExpiresIn = 1800
	mudahPayHTTPTimeout      = 10 * time.Second
	mudahPayMaxResponseSize  = 1 << 20
	mudahPayCurrency         = "MYR"
	mudahPayStatusPaid       = "paid"
	mudahPayEventPaid        = "transaction.paid"
)

// MudahPay implements DuitNow Dynamic QR payments for MYR.
type MudahPay struct {
	instanceID string
	config     map[string]string
	httpClient *http.Client
}

func NewMudahPay(instanceID string, config map[string]string) (*MudahPay, error) {
	if strings.TrimSpace(config["apiKey"]) == "" {
		return nil, fmt.Errorf("mudahpay config missing required key: apiKey")
	}
	if strings.TrimSpace(config["webhookSecret"]) == "" {
		return nil, fmt.Errorf("mudahpay config missing required key: webhookSecret")
	}
	cfg := cloneStringMap(config)
	currencyRaw := strings.TrimSpace(cfg["currency"])
	if currencyRaw == "" {
		currencyRaw = mudahPayCurrency
	}
	currency, err := payment.NormalizePaymentCurrency(currencyRaw)
	if err != nil {
		return nil, fmt.Errorf("mudahpay config currency: %w", err)
	}
	if currency != mudahPayCurrency {
		return nil, fmt.Errorf("mudahpay only supports MYR")
	}
	cfg["currency"] = mudahPayCurrency
	cfg["apiBase"] = normalizeMudahPayAPIBase(cfg["apiBase"])
	return &MudahPay{instanceID: instanceID, config: cfg, httpClient: &http.Client{Timeout: mudahPayHTTPTimeout}}, nil
}

func normalizeMudahPayAPIBase(apiBase string) string {
	base := strings.TrimSpace(apiBase)
	if base == "" {
		base = mudahPayDefaultAPIBase
	}
	return strings.TrimRight(base, "/")
}

func (m *MudahPay) Name() string        { return "MudahPay" }
func (m *MudahPay) ProviderKey() string { return payment.TypeMudahPay }
func (m *MudahPay) SupportedTypes() []payment.PaymentType {
	return []payment.PaymentType{payment.TypeMudahPay}
}

func (m *MudahPay) MerchantIdentityMetadata() map[string]string {
	return map[string]string{"currency": mudahPayCurrency}
}

func (m *MudahPay) CreatePayment(ctx context.Context, req payment.CreatePaymentRequest) (*payment.CreatePaymentResponse, error) {
	sen, err := payment.AmountToMinorUnit(req.Amount, mudahPayCurrency)
	if err != nil {
		return nil, fmt.Errorf("mudahpay amount: %w", err)
	}
	if sen < 100 {
		return nil, fmt.Errorf("mudahpay minimum amount is RM 1.00")
	}

	expiresIn := mudahPayDefaultExpiresIn
	if raw := strings.TrimSpace(m.config["expiresIn"]); raw != "" {
		if parsed, parseErr := strconv.Atoi(raw); parseErr == nil && parsed >= 60 {
			expiresIn = parsed
		}
	}

	body, err := json.Marshal(map[string]any{
		"amount":    sen,
		"reference": strings.TrimSpace(req.OrderID),
		"expiresIn": expiresIn,
	})
	if err != nil {
		return nil, err
	}

	respBody, err := m.doJSON(ctx, http.MethodPost, m.config["apiBase"]+"/transactions", body)
	if err != nil {
		return nil, fmt.Errorf("mudahpay create transaction: %w", err)
	}

	var resp struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Error   string `json:"error"`
		Data    struct {
			ID           string `json:"id"`
			QRDN         string `json:"qrdn"`
			QRIS         string `json:"qris"`
			UniqueAmount int64  `json:"unique_amount"`
			BaseAmount   int64  `json:"base_amount"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("mudahpay parse create response: %w", err)
	}
	if !resp.Success || strings.TrimSpace(resp.Data.ID) == "" {
		msg := strings.TrimSpace(resp.Message)
		if msg == "" {
			msg = strings.TrimSpace(resp.Error)
		}
		if msg == "" {
			msg = "unexpected response"
		}
		return nil, fmt.Errorf("mudahpay create transaction failed: %s", msg)
	}

	finalSen := resp.Data.UniqueAmount
	if finalSen <= 0 {
		finalSen = sen
	}
	qr := strings.TrimSpace(resp.Data.QRDN)
	if qr == "" {
		qr = strings.TrimSpace(resp.Data.QRIS)
	}
	return &payment.CreatePaymentResponse{
		TradeNo:   resp.Data.ID,
		QRCode:    qr,
		PayAmount: payment.MinorUnitToAmount(finalSen, mudahPayCurrency),
		Currency:  mudahPayCurrency,
	}, nil
}

func (m *MudahPay) QueryOrder(ctx context.Context, tradeNo string) (*payment.QueryOrderResponse, error) {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return nil, fmt.Errorf("mudahpay query missing transaction id")
	}
	body, err := m.doJSON(ctx, http.MethodGet, m.config["apiBase"]+"/transactions/"+url.PathEscape(tradeNo), nil)
	if err != nil {
		return nil, fmt.Errorf("mudahpay query transaction: %w", err)
	}
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID           string `json:"id"`
			Status       string `json:"status"`
			Amount       int64  `json:"amount"`
			PaidAmount   int64  `json:"paid_amount"`
			UniqueAmount int64  `json:"unique_amount"`
			PaidAt       string `json:"paid_at"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("mudahpay parse query response: %w", err)
	}
	status := payment.ProviderStatusPending
	if strings.EqualFold(resp.Data.Status, mudahPayStatusPaid) {
		status = payment.ProviderStatusPaid
	}
	amountSen := firstPositiveInt64(resp.Data.PaidAmount, resp.Data.UniqueAmount, resp.Data.Amount)
	return &payment.QueryOrderResponse{
		TradeNo:  firstNonEmpty(resp.Data.ID, tradeNo),
		Status:   status,
		Amount:   payment.MinorUnitToAmount(amountSen, mudahPayCurrency),
		PaidAt:   resp.Data.PaidAt,
		Metadata: m.MerchantIdentityMetadata(),
	}, nil
}

func (m *MudahPay) VerifyNotification(_ context.Context, rawBody string, headers map[string]string) (*payment.PaymentNotification, error) {
	timestamp := strings.TrimSpace(headers["x-mudahpay-timestamp"])
	signature := strings.TrimSpace(headers["x-mudahpay-signature"])
	if timestamp == "" || signature == "" {
		return nil, fmt.Errorf("mudahpay notification missing signature headers")
	}
	expected := mudahPaySignature(m.config["webhookSecret"], timestamp+"."+rawBody)
	if !hmac.Equal([]byte(expected), []byte(strings.ToLower(signature))) {
		return nil, fmt.Errorf("mudahpay notification invalid signature")
	}

	var payload struct {
		Event string `json:"event"`
		Data  struct {
			ID         string `json:"id"`
			Reference  string `json:"reference"`
			Amount     int64  `json:"amount"`
			PaidAmount int64  `json:"paid_amount"`
			Status     string `json:"status"`
			PaidAt     string `json:"paid_at"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(rawBody), &payload); err != nil {
		return nil, fmt.Errorf("mudahpay parse notification: %w", err)
	}
	status := payment.ProviderStatusFailed
	if strings.EqualFold(payload.Event, mudahPayEventPaid) || strings.EqualFold(payload.Data.Status, mudahPayStatusPaid) {
		status = payment.ProviderStatusSuccess
	}
	return &payment.PaymentNotification{
		TradeNo:  strings.TrimSpace(payload.Data.ID),
		OrderID:  strings.TrimSpace(payload.Data.Reference),
		Amount:   payment.MinorUnitToAmount(firstPositiveInt64(payload.Data.PaidAmount, payload.Data.Amount), mudahPayCurrency),
		Status:   status,
		RawData:  rawBody,
		Metadata: m.MerchantIdentityMetadata(),
	}, nil
}

func (m *MudahPay) Refund(context.Context, payment.RefundRequest) (*payment.RefundResponse, error) {
	return nil, fmt.Errorf("mudahpay refund is not supported")
}

func (m *MudahPay) doJSON(ctx context.Context, method, endpoint string, body []byte) ([]byte, error) {
	var reader io.Reader
	if body != nil {
		reader = strings.NewReader(string(body))
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", strings.TrimSpace(m.config["apiKey"]))
	if body != nil {
		req.Header.Set("content-type", "application/json")
	}
	client := m.httpClient
	if client == nil {
		client = &http.Client{Timeout: mudahPayHTTPTimeout}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, mudahPayMaxResponseSize))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return respBody, nil
}

func mudahPaySignature(secret, message string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

func firstPositiveInt64(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

var _ payment.Provider = (*MudahPay)(nil)
