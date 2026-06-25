import * as service from './ekyc.service.js';

/** POST /ekyc/intake — frontoffice pushes a new applicant / rekyc (secret auth). */
export async function intake(req, res) {
  res.status(202).json(await service.intake(req.body));
}

/** POST /ekyc — create an application from the backoffice. */
export async function create(req, res) {
  res.status(201).json(await service.createApplication(req.body, { createdBy: req.user.id }));
}

/** GET /ekyc — list applications. */
export async function list(req, res) {
  const items = await service.listApplications(req.query);
  res.json({ items, count: items.length });
}

/** GET /ekyc/:id — application with checks + documents. */
export async function getOne(req, res) {
  res.json(await service.getApplication(req.params.id));
}

/** PATCH /ekyc/:id */
export async function update(req, res) {
  res.json(await service.updateApplication(req.params.id, req.body));
}

/** POST /ekyc/:id/submit */
export async function submit(req, res) {
  res.json(await service.submit(req.params.id));
}

/** POST /ekyc/:id/checks — run a verification check. */
export async function runCheck(req, res) {
  res.status(201).json(await service.runCheck(req.params.id, req.body.type, req.body.payload));
}

/** POST /ekyc/:id/documents — attach a KYC document (base64). */
export async function attachDocument(req, res) {
  const doc = await service.attachDocument(
    req.params.id,
    {
      type: req.body.type,
      buffer: Buffer.from(req.body.contentBase64, 'base64'),
      contentType: req.body.contentType,
    },
    { uploadedBy: req.user.id },
  );
  res.status(201).json(doc);
}

/** POST /ekyc/:id/decision — approve | reject | hold. */
export async function decide(req, res) {
  res.json(await service.decide(req.params.id, req.body, { decidedBy: req.user.id }));
}
