// inbound_forward — hand inbound messages (accepted for our local domains) to
// the backoffice app's webhook, which parses bounces/complaints/replies.
//
// Outbound (relayed) mail is left untouched so Haraka core delivers it
// direct-to-MX. Only NON-relaying messages (i.e. mail arriving for our domain
// from the internet) are forwarded.

const constants = require('haraka-constants');

exports.register = function () {
  const cfg = this.config.get('inbound_forward.ini');
  this.url = cfg.main && cfg.main.url;
  this.token = cfg.main && cfg.main.token;
  if (!this.url) this.logerror('inbound_forward: no url configured (inbound_forward.ini)');
};

exports.hook_queue = function (next, connection) {
  // Relaying connections are our app's outbound submissions — let core deliver.
  if (connection.relaying) return next();

  const plugin = this;
  const txn = connection.transaction;
  if (!txn || !this.url) return next();

  txn.message_stream.get_data((buffer) => {
    fetch(plugin.url, {
      method: 'POST',
      headers: {
        'content-type': 'message/rfc822',
        'x-inbound-token': plugin.token || '',
      },
      body: buffer,
    })
      .then((res) => {
        if (res.ok) {
          connection.loginfo(plugin, 'inbound message forwarded to app');
          return next(constants.OK);
        }
        connection.logerror(plugin, `inbound webhook HTTP ${res.status}`);
        // Soft-fail so the sender retries rather than us losing the message.
        return next(constants.DENYSOFT, 'temporary processing error, try again later');
      })
      .catch((err) => {
        connection.logerror(plugin, `inbound webhook unreachable: ${err.message}`);
        return next(constants.DENYSOFT, 'temporary processing error, try again later');
      });
  });
};
