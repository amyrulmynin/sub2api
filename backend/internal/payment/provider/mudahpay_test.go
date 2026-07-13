//go:build unit

package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
)

func TestMudahPayCreatePaymentPreservesBaseAndUniqueAmounts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/transactions" {
			t.Fatalf("request = %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("x-api-key"); got != "api-key" {
			t.Fatalf("x-api-key = %q", got)
		}
		var body struct {
			Amount    int64  `json:"amount"`
			Reference string `json:"reference"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Amount != 1000 || body.Reference != "order-10" {
			t.Fatalf("body = %+v", body)
		}
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":{"id":"txn-10","qrdn":"duitnow-qr","base_amount":1000,"unique_amount":1001}}`))
	}))
	defer server.Close()

	provider, err := NewMudahPay("instance-1", map[string]string{
		"apiKey": "api-key", "webhookSecret": "webhook-secret", "apiBase": server.URL,
	})
	if err != nil {
		t.Fatal(err)
	}
	result, err := provider.CreatePayment(context.Background(), payment.CreatePaymentRequest{
		OrderID: "order-10", Amount: "10.00",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.BaseAmount != 10.00 || result.PayAmount != 10.01 || result.Currency != "MYR" {
		t.Fatalf("result = %+v", result)
	}
}

func TestMudahPayCreatePaymentFallsBackToRequestedAmount(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":{"id":"txn-10","qris":"fallback-qr","base_amount":0,"unique_amount":0}}`))
	}))
	defer server.Close()

	provider, err := NewMudahPay("instance-1", map[string]string{
		"apiKey": "api-key", "webhookSecret": "webhook-secret", "apiBase": server.URL,
	})
	if err != nil {
		t.Fatal(err)
	}
	result, err := provider.CreatePayment(context.Background(), payment.CreatePaymentRequest{
		OrderID: "order-10", Amount: "10.00",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.BaseAmount != 10.00 || result.PayAmount != 10.00 || result.QRCode != "fallback-qr" {
		t.Fatalf("result = %+v", result)
	}
}

func TestMudahPayCreatePaymentValidatesAuthoritativeAmountsAndQR(t *testing.T) {
	tests := []struct {
		name         string
		baseAmount   int64
		uniqueAmount int64
		qrdn         string
		qris         string
		wantPay      float64
		wantErr      string
	}{
		{name: "mismatched base", baseAmount: 999, uniqueAmount: 1001, qrdn: "qr", wantErr: "base_amount"},
		{name: "final below base", baseAmount: 1000, uniqueAmount: 999, qrdn: "qr", wantErr: "unique_amount"},
		{name: "final equals base", baseAmount: 1000, uniqueAmount: 1000, qrdn: "qr", wantErr: "unique_amount"},
		{name: "final above plus 99", baseAmount: 1000, uniqueAmount: 1100, qrdn: "qr", wantErr: "unique_amount"},
		{name: "valid plus 1", baseAmount: 1000, uniqueAmount: 1001, qrdn: "qr", wantPay: 10.01},
		{name: "valid plus 99", baseAmount: 1000, uniqueAmount: 1099, qris: "qr", wantPay: 10.99},
		{name: "missing QR", baseAmount: 1000, uniqueAmount: 1001, wantErr: "QR"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("content-type", "application/json")
				_, _ = fmt.Fprintf(w, `{"success":true,"data":{"id":"txn-10","qrdn":%q,"qris":%q,"base_amount":%d,"unique_amount":%d}}`, tt.qrdn, tt.qris, tt.baseAmount, tt.uniqueAmount)
			}))
			defer server.Close()

			provider, err := NewMudahPay("instance-1", map[string]string{
				"apiKey": "api-key", "webhookSecret": "webhook-secret", "apiBase": server.URL,
			})
			if err != nil {
				t.Fatal(err)
			}
			result, err := provider.CreatePayment(context.Background(), payment.CreatePaymentRequest{
				OrderID: "order-10", Amount: "10.00",
			})
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("error = %v, want containing %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if result.PayAmount != tt.wantPay || result.QRCode != "qr" {
				t.Fatalf("result = %+v", result)
			}
		})
	}
}
