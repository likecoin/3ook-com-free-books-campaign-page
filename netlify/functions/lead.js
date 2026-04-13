// Creates an Intercom lead and tags it via REST API, which works under
// Enforced Messenger Security (client-side writes are blocked).
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

  const contact = await contactRes.json();
  if (!contact?.id) {
    console.error('intercom contact missing id', contact);
    return new Response('upstream_error', { status: 502 });
  }

  const tagRes = await fetch('https://api.intercom.io/tags', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'freebook_requested',
      users: [{ id: contact.id }],
    }),
  });

  if (!tagRes.ok) {
    // Contact was created — don't fail the form if tagging trips.
    console.error('intercom tag error', tagRes.status, await tagRes.text());
  }

  return new Response('ok');
};
