// The results email for path A (voice skill, email register). Joe approves this file's content;
// lib/email.js refuses to send unless sha256(subject + text + html) matches the hash recorded in
// the Global Config `approved_templates["results-screenshot"]` AND in the project README's
// "Approved email templates" section. Any edit here changes the hash and fails closed.
// Slots: {first_name} {business_name} {results_block} {results_url} {booking_url} {postal_address}
export const id = 'results-screenshot';
export const subject = 'Your AI action plan from AroWise Automation';

export const text = `Hi {first_name},

Here's the plan you built on your phone, so you have it when you're back at your desk:

{results_block}

You can open the full version any time: {results_url}

If you want help building any of these for {business_name}, book a time with me here and we'll pick the first one together: {booking_url}

Thank you,

Joe Mascaro

joe@arowise.com
AroWise Automation

{postal_address}
You got this because you asked for your results at arowise.com.`;

export const html = `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#F2F6F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B2226;font-size:16px;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;padding:28px 28px 20px;border:1px solid #C4D0D4">
<p style="margin:0 0 16px">Hi {first_name},</p>
<p style="margin:0 0 16px">Here's the plan you built on your phone, so you have it when you're back at your desk:</p>
{results_block}
<p style="margin:16px 0">You can open the full version any time: <a href="{results_url}" style="color:#00777A">{results_url}</a></p>
<p style="margin:0 0 16px">If you want help building any of these for {business_name}, book a time with me here and we'll pick the first one together: <a href="{booking_url}" style="color:#00777A">{booking_url}</a></p>
<p style="margin:0 0 4px">Thank you,</p>
<p style="margin:16px 0 0">Joe Mascaro</p>
<p style="margin:12px 0 0;color:#3A464B">joe@arowise.com<br>AroWise Automation</p>
<p style="margin:24px 0 0;font-size:12px;color:#5A676C">{postal_address}<br>You got this because you asked for your results at arowise.com.</p>
</div></body></html>`;
