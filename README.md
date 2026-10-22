## Publicar na Netlify — edição 08

Código do Premium na branch `atelier-premium` de `cristiano79aju/bordado`. A branch `main` mantém o gestor antigo. Na importação Git da Netlify, selecione **atelier-premium**, diretório base vazio, comando **npm run build:netlify**, publicação **build/client** e funções **build/functions**. O `netlify.toml` já define o build. Use Node 22 e instale com `npm ci`.

Não publique `dist` diretamente: há código de geração de matrizes destinado ao servidor. O build cria uma pasta pública separada e uma Function para `/api/pix/*`, usando o mesmo checkout validado da versão Sites. Não exige cadastro do cliente. O projeto inclui os testes em `tests/`; execute `npm run build:netlify && npm run test:checkout`.

Em **Project configuration → Environment variables**, cadastre valores com escopo **Functions** para a produção (nunca no repositório):

| Variável | Valor |
| --- | --- |
| `CHECKOUT_SECRET` | 32 bytes aleatórios em Base64; gere uma vez com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` em seu computador |
| `ASAAS_API_KEY` | Chave de API de produção da conta recebedora Asaas |
| `ASAAS_PIX_KEY` | Chave Pix já cadastrada nessa mesma conta Asaas |
| `PIX_LIVE_ENABLED` | `false` durante configuração; `true` quando estiver pronto para testar o recebimento real |

Após alterar variáveis, faça um novo deploy. Mantenha `PIX_LIVE_ENABLED=false` em previews e branches de teste. O secret é persistente: a troca invalida os comprovantes de acesso antigos. Ao migrar entre provedores, conserve o mesmo secret se já houver compras. Projetos salvos no navegador são vinculados ao endereço do site: baixe os JSONs e os comprovantes de acesso antes de mudar de domínio.

No Asaas, abra a área de **Integrações / chaves de API** e use uma chave da conta de produção. Para o recebedor, confira a chave em **Pix / Minhas chaves**. Não publique nem envie credenciais pelo chat. Não é preciso cadastrar webhook para este fluxo: a confirmação consulta o Asaas no servidor. A conta deve estar aprovada e apta a receber Pix. O código vem com recebimento desligado; o build não cria nem recebe pagamentos reais.

Teste final depois da configuração: uma matriz pequena deve cotar R$ 1; gere um Pix, confira o recebedor no aplicativo bancário e efetue o teste somente com a conta correta. Antes do pagamento, PES/DST devem ficar bloqueados. Após confirmação, os dois formatos devem baixar. Teste também a recuperação pelo comprovante. Esse teste bancário ainda não foi feito.

**Novo projeto** agora fica no cabeçalho e em Meus projetos. Salva o atual antes de abrir uma tela vazia, reinicia seleção, desenho, histórico e simulação. Se o navegador não conseguir salvar, mantém o trabalho atual e oferece baixar um backup em JSON antes de iniciar outro. Também descarta resultados de importação que ainda estiverem em andamento quando o usuário troca de projeto.

Referências oficiais Netlify: https://docs.netlify.com/build/functions/get-started/ e https://docs.netlify.com/build/functions/environment-variables/ .

# BordAI Atelier — Premium

Independent buildless embroidery studio. This is a new source tree and a new Site, created independently; the original BordAI Trace publication is unchanged. User reference PES files are used locally for validation, never bundled as assets.

## Implemented

- Original uppercase centerline satin alphabets, condensed variation, digits and Portuguese accents; per-column width, nodes, manual entry direction, spacing and pull compensation.
- Manual satin and polygon tools; running stitches; fill contours with even-odd holes; automatic underlay and native run tie-ins/offs.
- Fill rows are sequenced by nearby region endpoints; short connectors are allowed only where every sampled point stays inside the object's geometry. Manual versus optimized route comparison reports measured travel and jumps. Color grouping is explicit because stacking order matters.
- PES/PEC and DST imports retain machine commands. Unmodified single-file exports in the same format return original bytes. Imported points are not falsely presented as editable native columns. DST uses an illustrative palette and displays a warning because DST does not carry RGB colors.
- Flat-art image extraction creates editable polygon contours, not production-ready automatic lettering. The source image is rasterized to at most 768 pixels along its longest side; details require review.
- Real-command thread rendering, inspection blue without changing exported colors, needle-point view, jump display, simulation, selection/movement, undo/redo and size controls for native objects.
- Review markers for excessive widths, tight turns, short stitches, overlaps, large cuts count and hoop dimensions. Export blocks geometric errors. A clean review does not certify physical embroidery.
- PES with RGB, DST with three-jump trim representation, editable project JSON, PNG, printable production sheet. EMB is not generated.
- Local browser project library with explicit save checkpoints and previous-version restore. No cloud account, billing or cross-device sync is represented as implemented.

## Verification

`node tests/verify.mjs [optional PES fixture paths...]`

`python tests/decode.py [same optional PES fixture paths...]` (independent pyembroidery installation)

Native satin points match an independent PES/DST decoder. Three supplied PES fixtures were compared command by command and color by color. Rewritten PES also retain their needle coordinates and cut-request counts.

A hole regression checks every tenth of each stitch segment for crossing the rectangular void. Region ordering reduced 131 jumps /128 trims to 8 jumps /6 trims on that fixture (travel 2842.8 →180.1 mm). This is a fixture result, not a universal percentage claim.

Browser QA exercised lettering, vector image import with a hole, PES import, bounds errors, route comparison, properties and review UI. Native export URLs and source encoders were verified. Automated browser download-event capture timed out, so completed browser downloads were not independently captured. This environment does not run Wilcom or an embroidery machine: opening in Wilcom e4.2 and sew-out tests remain required.

## Runtime

Serve `dist/` as static files. No build or third-party CDN dependencies. Project data remains local to the browser and can be backed up as JSON. Uploaded designs are not posted to a server by this application.

## Route update — imported matrices

The **Otimizar saltos e comparar** action now also optimizes imported needle files. It reorders independent runs within each existing color block, retains original needle direction and exact directed sewn segments, and protects overlapping envelopes with original precedence. It checks native route alternatives as well. A candidate is applied only when total jump travel, jumps and trims do not increase and at least one improves. It never adds an exposed running stitch to replace a jump. Imported internal commands are only resequenced through the explicit action; undo restores the original state and original-byte export eligibility.

The persistent comparison shows measured jump travel, counts and cuts, rather than a claimed machine-time or thread-consumption percentage. A dashed travel path after a trim does not represent thread stretched across the fabric. Some required travel remains; no shortest-path optimality or physical sew-out certification is claimed.

`node tests/routes.mjs [PES fixture paths...]` verifies source immutability, overlap precedence, unsupported-command preservation, exact colored directed needle segments, round-trip PES colors, and non-increasing jumps/cuts/travel. Independent pyembroidery checks also verified optimized PES and DST directed needle segments for all five local fixtures. Reference files are never bundled.

Observed fixture results: Laura travel 495.0 →463.6 mm with 26 jumps and 23 cuts preserved; CBF 635 →619 jump commands with 194 cuts preserved; another CBF travel 1662.3 →1624.4 mm with its 384 jumps and 181 cuts preserved. Two other fixtures were left unchanged when no acceptable improvement was found. Values are design-specific and do not establish production-time or thread-mass savings.

## Integrated digitization and production workflow

Image import now runs a local geometry pipeline at 768 pixels along the longest side. It quantizes flat colors, splits connected regions, traces even-odd contours, and analyzes narrow strokes using topology-preserving binary thinning, a distance field and editable variable-width centerlines. Column rails are clipped to the source contour. A fit must cover at least 95% of the region's sampled pixels before automatic satin is suggested; ambiguous or wide regions retain editable fill contours. Very thin suitable strokes may be suggested as running stitch. This is geometry-based digitization, not OCR, semantic text recognition, trained AI, or a promise of physical embroidery quality. No model training or self-learning happens.

Original implementation; algorithm documentation consulted: https://docs.opencv.org/4.12.0/df/d2d/group__ximgproc.html (Zhang–Suen thinning). No OpenCV runtime or source is bundled.

Each connected region is an independent object. Local edits do not regenerate the rest of the image. Users can change region stitch type, width, center nodes and silhouette clipping, order columns, choose the first column and lock sequence. Size controls can maintain aspect ratio, update silhouettes and variable widths, and recalculate stitches. Oversized detected columns become fill when needed for fabric compensation.

Fabric starting profiles for flat woven fabric, knit/polo and towels configure spacing, pull compensation and underlay for native objects. Imported machine points retain their existing density. Profiles are starting values, not certified machine recipes.

The density view counts needle penetrations in 1 mm² cells and provides a geometric concentration review. Review also identifies tight turns, overlaps, limited coverage estimates and long jumps without explicit trim commands. These heuristics require inspection and a sew-out; they do not detect every defect or certify a clean file.

The local sample history records machine, fabric/stabilizer, thread/needle, measured time, thread breaks, optional observed cuts and measured thread consumption, notes and optional photo. It saves a preview of that exact design version beside the photo. Approval is explicitly entered by the user. A geometry signature marks a previous sample as stale after stitch-affecting edits. Records are browser-local and included in editable JSON backups; no physical sewing has been performed by the application.

Validation: `node tests/digitizer.mjs` verifies automatic I/T/L/ring classification, fill fallback for a large solid area, hole/outline safety by sampling every needle segment, PES round-trip point counts, fabric changes, resize recalculation, geometric signatures, region edit isolation and concentration warnings. New generated PES and DST needle coordinates also matched independent pyembroidery decoding. Browser QA exercised a flat-art image with three narrow letters and a solid circle (three satin regions and one fill), fabric application, resize, sample-state invalidation, density view, sample form save and optional image/photo history. Browser test sample records were explicitly labeled fictitious interface tests; they are not sew-out evidence and are not bundled in this repository.

### Complex artwork import correction

The fixed 160-component rejection was removed. The first 150 components remain independent; subsequent components are retained as compound fill objects per palette color, preserving disconnected contours and holes without deleting pixels. The import notification reports the grouped detail count. Grouped details intentionally use fill and require production review, especially at small physical sizes. Existing object, geometry and stitch budgets still apply transactionally. `node tests/many-regions.mjs` verifies all 420 regions, area, contour counts, both analysis modes, compilation and JSON restoration. The subsequently attached five artwork files were also exercised through the new raster preparation and compilation pipeline.

### Delicate artwork and tonal-gradient preparation

Two explicit import modes were added: delicate artwork and tonal gradient. Delicate mode rasterizes at 384px maximum, performs edge-aware texture smoothing, retains contrast features through a fitted up-to-10-color palette, and merges small low-contrast texture fragments into adjoining colors. This is a lossy preparation step, not semantic reconstruction; users must compare delicate details with the source. Thin geometric strokes can use existing running/satin fitting, and running uses 1.2mm length without underlay. Wider fills retain standard stitch length. Gradient mode approximates the image through quantized thread-color bands, with a common horizontal fill direction and without stacking full-density color layers over the same area. It does not generate continuous thread painting or guarantee visually seamless transitions. Interior white is retained when source transparency provides the background mask.

Isolated one/two-pixel regions under 0.3mm are retained as visual references and explicitly reported in import feedback and persistent review warnings; they are not silently exported as stitches. Compound details remain grouped by color. The 30k-node, 200-object and total stitch safety budgets remain active.

Validation: `node tests/raster.mjs` checks input immutability, white-inside-transparency, high-contrast fine line retention, eight tonal colors and explicit microdetail warnings. Five supplied artwork files compiled at 90mm in the respective new modes using a PIL-resized raster fixture; browser-native uploads of the gradient logo and fourth elephant additionally succeeded. Native Canvas and PIL rasterization produce different counts. Browser elephant output still had thousands of jumps/cuts, and therefore is not production-optimized or approved: manual regional cleanup and a real sew-out remain necessary. Gradient output is visibly stepped, not a validated blended gradient. None of these tests certifies professional machine output or Wilcom compatibility. Customer files and screenshots are not included in the source bundle.

### Production route optimization (edition 05)

Import now invokes production comparison automatically. The existing button reruns comparison for older projects and matrices. A module worker compares existing, interior-only, and future-covered routing without mutating the submitted geometry or color order. The chosen native variant cannot increase jumps, cuts or jump distance; combined sewn + jump distance is capped at 3% above the baseline. This is a bounded heuristic, not a global optimum or a measured machine cost. The UI reports sewn-thread length separately because replacing jumps with sewn connectors may increase it. Existing PES/DST optimization still preserves directed colored needle segments.

Native dense fills prioritize reachable scanlines, then use bounded A* routing (0.3mm grid, 1200 expansions, maximum 8mm connector, at most two new connector passes per project grid cell). Future concealment is permitted only inside later dense native fill contours, with a conservatively eroded 0.5mm raster margin; imported matrices, satin, sparse fills and references never promise future cover. No color blocks are reordered. Geometry changes rebuild routing and invalidate earlier proof signatures.

Polygon-edge interval checks now replace sampled-only straight-connector checks: a regression exposed a very short corner crossing that the old 0.08mm sampling could miss. Synthetic tests verify hole exclusion, exposed gaps, future coverage order and boundary clearance. All five supplied 90mm raster fixtures passed cost/geometry checks: jumps 4570→2477, 3920→1938, 5418→2817, 6561→3714, 1033→606. Counts depend on rasterizer, dimensions and settings. The complex fixture exported 31336 needle points, independently decoded with pyembroidery from both PES and DST and matched coordinate-for-coordinate. Original artwork objects are byte-for-byte unchanged by native production optimization.

The photographic elephant references still generate thousands of moves/cuts; this release reduces them, not certifies them as production-ready or semantically reconstructs the original embroidery. True output quality, thread visibility under later fills and machine timing must be validated by an actual sew-out.

### Adaptive automatic import (edition 06)

The default automatic import now measures the generated editable geometry. Above 24000 nodes or 4000 contours in an object, it reprocesses the original image with the existing delicate preparation automatically (384px, edge-aware texture smoothing, bounded palette). The inspector and import feedback disclose this preparation. It does not truncate the raw contour list or simply raise the 30000-node editing budget. This treatment is lossy texture preparation, so fine details still require comparison with the source and a sew-out. Explicit contour and gradient choices retain their respective modes.

The four exact new uploads were tested through the shared `artwork-profile.mjs` raster pipeline at 90mm / eight colors using bilinear PIL raster fixtures: raw→prepared nodes were 141364→9715, 212524→13505, 340535→18533 and 236820→18862. All four compiled without geometric errors after adaptation. Browser Canvas also imported the new elephant-with-balloons PNG with the default `auto` selection; the inspector explicitly showed automatic delicate preparation and the production comparison completed. PIL and Canvas produce different counts. The earlier hard-coded rejection still guards genuinely excessive final geometry, but these four supplied artworks no longer hit it in the tested settings. `node tests/artwork-profile.mjs` verifies adaptation thresholds, immutable source bytes and persistent disclosure metadata.

### Guest Pix export checkout (edition 07)

The user sets the commercial rule to BRL 1 per started block of 1000 sewn needle commands. There is no BRL 5 minimum, subscription or account registration. Preview and device-local editable backups remain available; PES and DST downloads pass through the paid server endpoint. The server validates submitted coordinates, command types and palette, generates both machine files, and independently recounts the serialized needle commands; jumps, trims and color changes are not billed. If serialization splits a long sewn movement, the higher actual needle count of the two offered formats determines the disclosed quote. The same immutable point/color version unlocks both formats; renaming does not change its purchase identity.

The static application is migrated to an ESM Worker with embedded browser assets. The browser no longer receives the PES/DST writers or direct matrix download blobs. A payment check is required on every server file download; changing client-side paid flags cannot authorize that endpoint. Geometry and preview points still exist in the browser for the editor and editable backup. This is not DRM and cannot prevent someone independently encoding their own browser-visible data.

No customer account, email or CPF form is required by this implementation. It uses Asaas static Pix QR codes with a fixed amount, a separate identifier, a 15-minute expiry and `allowsMultiplePayments:false`. Official reference: https://docs.asaas.com/docs/creating-a-static-qr-code and https://docs.asaas.com/reference/criar-qrcode-estatico . Payment verification queries Asaas by `pixQrCodeId` and requires `billingType=PIX`, `status=RECEIVED`, exact gross amount, correct QR identifier and no deletion/refund. No screenshot, local flag, callback URL, or button can mark a payment as received. Asaas account activation and an accepted Pix key are prerequisites.

Files and QR metadata are bundled into AES-256-GCM encrypted, gzip-compressed bearer tokens. The files stay in the encrypted client-held token, rather than a public file store; the persistent server secret must not be rotated casually or earlier access tokens become unreadable. Payment status is always rechecked from Asaas. A token expires after 30 days, disclosed in the checkout. Local storage/session storage retain it for repeat downloads. A downloadable access receipt can restore it for the same matrix version. QR images and payloads from a restored receipt are only displayed after the server decrypts and validates the original metadata, avoiding trusting a supplied bank QR. The editable project backup is separate and must be retained for restoring the exact version. Repeated create requests can issue more than one unpaid QR for a quote; generating a QR does not debit a customer, and the UI prevents concurrent creation. Only the individual QR paid by the customer is an entitlement; the system never initiates a debit.

Production runtime names: `CHECKOUT_SECRET` (32 random bytes, Base64, secret), `ASAAS_API_KEY` (secret), `ASAAS_PIX_KEY` (secret recommended), `PIX_LIVE_ENABLED=true` only after receiver setup. API calls use the production Asaas domain only. The currently provisioned checkout encryption secret is stored in the native runtime. Asaas credentials and recipient key have NOT been supplied, and live charging remains OFF. The customer UI reports this honestly and never generates a demonstration bank QR. No real transaction has been performed. Native tests mock the provider in isolation, including pending, wrong amount/QR, refund, tampered token, cross-origin rejection, disabled activation and repeat PES/DST downloads. `node tests/pix.mjs` verifies these and boundary prices; existing embroidery regression suites also pass.

Build: `node scripts/build-payments.mjs` generates a standalone `dist/server/index.js`, an embedded allowlist of browser assets, and the deployment manifest. No D1/R2 migrations or new Supabase project are required. `npm run dev` is the supervised local preview; it uses an ephemeral local encryption secret and permanently disabled live payment credentials. Browser QA confirmed a server-quoted 513-point matrix at BRL 1, absent signup fields and disabled paid downloads while receiver setup is incomplete. Successful real-bank authorization, live QR creation, and a real paid download remain unverified until the account is connected.
