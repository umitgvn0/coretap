export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, description, amount, payload } = req.body;
  const token = process.env.TELEGRAM_BOT_TOKEN; // Vercel Environment Variables'a ekleyeceğiz

  if (!token) {
    return res.status(500).json({ error: 'Telegram Bot Token is missing' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || "CoreTap VIP Ödeme",
        description: description || "CoreTap oyun içi ödeme",
        payload: payload || "custom_payload",
        provider_token: "", // Telegram Stars için boş bırakılır
        currency: "XTR", // XTR = Telegram Stars para birimi
        prices: [{ label: title || "Stars", amount: parseInt(amount) }] // Yıldız miktarı (örn: 300)
      })
    });

    const data = await response.json();

    if (!data.ok) {
      return res.status(400).json({ error: data.description || 'Telegram API Error' });
    }

    return res.status(200).json({ invoiceLink: data.result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}