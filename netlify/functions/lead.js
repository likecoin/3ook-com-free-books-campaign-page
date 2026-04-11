// Creates an Intercom lead and fires the trigger event via REST API, which
// works under Enforced Messenger Security (client-side writes are blocked).
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const { email, hp } = body;

  // Silently 200 so bots can't tell they were filtered.
  if (hp) return new Response('ok');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('bad email', { status: 400 });
  }

  const token = Netlify.env.get('INTERCOM_TOKEN');
  if (!token) {
    console.error('INTERCOM_TOKEN not set');
    return new Response('config_error', { status: 500 });
  }

  const headers = {
    Authorization:      `Bearer ${token}`,
    'Content-Type':     'application/json',
    Accept:             'application/json',
    'Intercom-Version': '2.11',
  };

  const contactRes = await fetch('https://api.intercom.io/contacts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      role: 'lead',
      email,
    }),
  });

  if (!contactRes.ok) {
    console.error('intercom contact error', contactRes.status, await contactRes.text());
    return new Response('upstream_error', { status: 502 });
  }

  const eventRes = await fetch('https://api.intercom.io/events', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event_name: 'freebook_requested',
      created_at: Math.floor(Date.now() / 1000),
      email,
      metadata: {
        utm_source:   body.utm_source,
        utm_campaign: body.utm_campaign,
        lead_page:    body.lead_page,
      },
    }),
  });

  if (!eventRes.ok) {
    // Lead exists — event drop is recoverable from Intercom admin, don't fail form.
    console.error('intercom event error', eventRes.status, await eventRes.text());
  }

  return new Response('ok');
};
