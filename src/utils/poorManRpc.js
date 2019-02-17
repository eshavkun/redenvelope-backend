module.exports = (fetch, url) => (method, params) =>
  fetch(url, {
    method: 'POST',
    body: JSON.stringify({ jsonrpc: "2.0", id: 2895, method, params }),
    headers: { 'Content-Type': 'application/json' },
  }).then(resp => resp.json()).
  then(resp => resp.result);