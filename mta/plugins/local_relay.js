// local_relay — grant relaying to trusted internal clients only.
//
// This on-prem MTA only ever receives mail from the backoffice app on the same
// host / Docker network (a private address). We mark those connections as
// "relaying" so Haraka accepts recipients in any domain and delivers them
// outbound (direct-to-MX). Public clients are never granted relaying, so this
// is NOT an open relay. The submission port is also bound to localhost in
// docker-compose as defense in depth.
//
// For production you can additionally require SMTP AUTH (auth/flat_file) and/or
// tighten the allowed networks below.

const constants = require('haraka-constants');

exports.register = function () {
  // Extra explicit CIDRs allowed to relay (besides RFC1918/private). One per
  // line in config/relay_allow_hosts. Optional.
  this.allow = this.config.get('relay_allow_hosts', 'list') || [];
};

function isTrusted(plugin, connection) {
  const remote = connection.remote;
  if (!remote || !remote.ip) return false;
  // Private/loopback addresses = our own host / Docker network.
  if (remote.is_private) return true;
  // Explicit allow-list (exact IP match; extend with CIDR if needed).
  return plugin.allow.includes(remote.ip);
}

exports.hook_connect = function (next, connection) {
  if (isTrusted(this, connection)) {
    connection.relaying = true;
    connection.loginfo(this, `relaying granted to trusted client ${connection.remote.ip}`);
  }
  next();
};

exports.hook_rcpt = function (next, connection) {
  // Accept any recipient for trusted (relaying) clients; the core outbound
  // queue then delivers direct-to-MX.
  if (connection.relaying) return next(constants.OK);
  next();
};
