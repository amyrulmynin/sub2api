package service

import (
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
)

func paymentStatsOrders() ([]*dbent.PaymentOrder, time.Time) {
	todayStart := time.Date(2026, time.July, 12, 0, 0, 0, 0, time.UTC)
	today := todayStart.Add(time.Hour)
	yesterday := todayStart.Add(-time.Hour)
	return []*dbent.PaymentOrder{
		{UserID: 1, UserEmail: "one@example.com", PaymentType: "stripe", Amount: 10, PayAmount: 40, PaidAt: &today},
		{UserID: 1, UserEmail: "one@example.com", PaymentType: "stripe", Amount: 20, PayAmount: 50, PaidAt: &yesterday},
		{UserID: 2, UserEmail: "two@example.com", PaymentType: "mudahpay", Amount: 60, PayAmount: 90, PaidAt: &today},
	}, todayStart
}

func TestPaymentBasicStatsAggregateCreditedProductAmount(t *testing.T) {
	orders, todayStart := paymentStatsOrders()
	stats := &DashboardStats{}
	computeBasicStats(stats, orders, todayStart)
	if stats.TodayAmount != 70 || stats.TotalAmount != 90 || stats.AvgAmount != 30 {
		t.Fatalf("basic stats used settlement amount: today=%v total=%v average=%v", stats.TodayAmount, stats.TotalAmount, stats.AvgAmount)
	}
}

func TestPaymentMethodDistributionAggregatesCreditedProductAmount(t *testing.T) {
	orders, _ := paymentStatsOrders()
	methods := buildMethodDistribution(orders)
	methodAmounts := map[string]float64{}
	for _, method := range methods {
		methodAmounts[method.Type] = method.Amount
	}
	if methodAmounts["stripe"] != 30 || methodAmounts["mudahpay"] != 60 {
		t.Fatalf("method distribution used settlement amount: %#v", methodAmounts)
	}
}

func TestPaymentTopUsersAggregateCreditedProductAmount(t *testing.T) {
	orders, _ := paymentStatsOrders()
	topUsers := buildTopUsers(orders)
	if len(topUsers) != 2 || topUsers[0].UserID != 2 || topUsers[0].Amount != 60 || topUsers[1].Amount != 30 {
		t.Fatalf("top users used settlement amount: %#v", topUsers)
	}
}

func TestPaymentDailySeriesAggregatesCreditedProductAmount(t *testing.T) {
	orders, todayStart := paymentStatsOrders()
	series := buildDailySeries(orders, todayStart.AddDate(0, 0, -1), 1)
	if len(series) != 1 || series[0].Amount != 70 || series[0].Count != 2 {
		t.Fatalf("daily series used settlement amount: %#v", series)
	}
}
