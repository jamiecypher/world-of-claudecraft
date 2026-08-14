# Wooden Toy Train Stage 1 review

Status: stopped at the required primitive-blockout approval point.

## Locked proposal

- Train geometry: 2.370 wide, 2.280 high, 6.140 long.
- Driver root: `(0.066, 1.18, 0.38)`, forward-facing.
- Passenger 1 root: `(0.066, 1.16, -1.32)`, forward-facing.
- Passenger 2 root: `(-0.066, 1.16, -2.78)`, rear-facing, settled 0.040 into the rear cushion.
- Seat centering is measured from the skinned vertex envelope influenced by the `hips` and
  both `upperleg` bones to the physical seat edges. The bare hips joint alone is not a
  sufficient visual-center measurement because the seated mesh is asymmetric around it.
- Each real seated knight measures about 1.440 wide, 1.360 deep, and 2.576 high in the captured pose.
- The two opposing caboose rider bounds now have 0.171 units of longitudinal clearance,
  still substantially above the original roughly 0.03 units, without changing the train
  geometry length.
- The model uses `Engine`, `CouplingPivot`, and `Caboose` groups plus all three explicit socket nodes.
- The revised blockout follows `train2.png`: separate body frames around an open drawbar gap,
  small-to-medium-to-large engine wheels, and a consistent two-wheel caboose rhythm.
- The wheel/deck relationship follows the clean train-only side-view panel in `train2.png`.
  Wheels sit outboard of broad, flat wooden side frames instead of living inside individual
  fenders or exposed ornamental railwork. Each vehicle uses one dark side board with simple red
  top and bottom edge bands. The wheels deliberately overlap that board in profile, matching the
  toy-train reference, while the narrowed hidden chassis remains behind them.
- All three seating assemblies use the same dark charcoal-gray body color as the boiler and
  wheels, including pod walls, backs, and the rear bench. This keeps the cabin masses cohesive
  while giving the red frame bands a clean contrast.
- Wheel placeholders now establish the intended shared style at every size: six red spokes and
  an inset red rim, a darker charcoal tread, and a tread-black hub that anchors the center without
  blending into either gray body layer. The two engine drivers use separate red crank bosses and
  dark pins carrying a red coupling rod; the rod is physically seated on both pins rather than
  floating over the wheel faces. The spoke fields remain complete and symmetric, with no filled
  counterweight sectors. Both drivers now use a 0.560 radius and share an exact 0.720 axle height,
  while caboose wheels remain 0.380 so the engine owns the wheel hierarchy. Matching driver
  radii, crank offsets, and per-side phases allow each coupling rod to remain truly rigid.
- Red wheel rims overlap the dark tread envelope by 0.040 times each wheel radius. This replaces
  the original near-zero 0.005 overlap that allowed faceted rims to show intermittent gaps,
  especially on the large drivers.
- A deliberately simplified steam-drive prototype is fitted symmetrically on both engine sides:
  compact low cylinders, capped piston rods, guided crossheads, and red connecting rods terminating
  at the middle driver's existing crank pins. The crossheads are solved from a fixed horizontal
  guide and a 0.780 connecting-rod length, and the left/right crank sets are quartered 90 degrees.
  Named runtime contract data is stored on `Engine.userData.steamDrive` for later procedural
  animation. Secondary valve gear and pipework remain deferred.
- The outside motion uses explicit depth layers so it does not intersect the wheel faces: spoke
  face, raised crank boss and pin, slim coupling rod, then slim connecting rod. The rods still
  cross portions of the spoke field in side profile because they physically terminate at the
  off-center crank pins, but no rod is coplanar with or embedded inside the wheel geometry.
- The cylinder and slider guide are mounted on a 0.970 horizontal line, placing the cylinder's
  lower edge 0.020 above the leading wheel envelope. Two visible brackets per side connect the
  crosshead guides to the engine side frame, and each piston rod is sized from its side's actual
  quartered crosshead position to the cylinder face rather than using a decorative fixed length.
- Center sills terminate inside the charcoal side boards instead of occupying the same lateral
  volume, eliminating red/charcoal surface fighting behind the wheels. Pod side walls and lower
  side frames share a flush outer plane, while pod end panels terminate between the side walls
  rather than overlapping beneath them.
- The Passenger 1 front panel now shares the side walls' exact 0.730 to 1.630 vertical span and
  embeds 0.020 units into each perpendicular corner joint, removing the rasterized hairline gap
  and unintended 0.010 lower overhang.
- Passenger 1's front wall is moved 0.130 forward to contain the seated foot envelope without
  moving the rider or thickening the panel. Passenger 2 and the complete rear bench assembly move
  0.080 forward together. The bench support now overlaps the chassis top and seat bottom, making
  the exposed rear seat a continuous cantilevered assembly rather than floating geometry.
- Passenger 1's compartment is generated from one shared rectangular envelope: both side walls
  use identical depth and Y bounds, and both end walls derive from the same outer X, Y, and Z
  planes with 0.020 hidden corner embeds. The lower side board is recessed behind this envelope,
  while the chassis is narrowed inside that board, leaving no coplanar gray or red face competing
  with the visible charcoal panel.
- The caboose silhouette now uses one consistent 1.960-unit outer shell width from lower side
  board through pod walls. Red ornament is applied as 0.015-unit surface bands on that shell,
  rather than wider stacked rails used to create silhouette. Lower board and pod meet on the exact
  Y=0.730 plane. Rear bench seat, back, and support share one 1.780-unit structural width.
- The driver pod now uses the same squared-shell construction logic: 1.960-unit outer width,
  equal 1.280-unit side walls, and a rear end wall embedded 0.020 into both corners instead of a
  narrower panel centered on the wall endpoints. The rear bench backrest now contacts the seat
  edge directly, while a recessed charcoal pedestal connects the seat bottom to the caboose
  chassis without a visible red upright intruding into the seating silhouette.
- Driver and Passenger 1 rider roots remain fixed while their squared shells extend rearward by
  0.120 and 0.140 units respectively. Each charcoal seat base receives a thin rounded red seat
  cushion, and each rear wall receives a rounded red back cushion inset inside the shell. Passenger
  1's expanded rear wall retains 0.140 units of shell-to-bench clearance.
- The Passenger 2 bench zone uses charcoal above the red stripe for the sill, pedestal, seat frame,
  and backrest. Below that stripe, the rear chassis continues the same light-gray mechanical
  underframe color used at the front of the caboose. A thin inset red cushion sits on the charcoal
  bench frame while preserving its existing seat surface.
- The charcoal upper finish begins at the rear face of Passenger 1's compartment (`Z=-2.020`)
  and continues through the rear edge. The upper center sill also changes to charcoal at that
  boundary beneath Passenger 2's bench, while the lower thin red surface band remains continuous
  across the full caboose length nearest the wheels. The light-gray mechanical chassis continues
  below it. All base layers share exact front and rear planes at `Z=-0.820` and `Z=-3.140`,
  eliminating staggered rear bumper pixels.
- The rear chassis is split vertically at the red stripe: its visible upper section beneath the
  bench is charcoal, while only the lower mechanical rail beneath the stripe is light gray. The
  full-length outer lower side board follows that same light-gray mechanical treatment.
- The rear bench is integrated into the caboose mass like the `train2.png` reference rather than
  perched on a narrow column. Upper chassis, pedestal, seat frame, and backrest now share a
  1.780-unit structural width. Pedestal and seat terminate with the base layers on the canonical
  `Z=-3.140` rear plane; only the red cushion is deliberately inset 0.040 per side and 0.040 at
  the rear so its smaller edge reads as upholstery rather than a construction mismatch.
- The patched caboose base has been replaced outright by three continuous masses spanning
  `Z=-0.560` through `Z=-3.200`: one light-gray mechanical underframe, one red sill, and one
  charcoal passenger body. Passenger 1's front wall now lands directly on the body's front plane,
  with the red sill wrapping that face. The rear bench seat grows directly from the continuous
  charcoal body; no pedestal or masking side panel remains. This increases caboose length by
  0.380 and total train geometry length by 0.060 while preserving every rider socket.
- Passenger 1's rear wall and Passenger 2's backrest are one `Caboose_SharedSeatBulkhead`. It uses
  the pod's exact 0.200 wall thickness and 0.510 upper-wall height, but now spans the full 1.960
  caboose shell width. Its front face lands on the sidewalls' shared `Z=-2.160` rear plane, making
  one continuous transverse wall and top edge from outer side to outer side rather than an inset
  board between them. The Passenger 1 back cushion is seated against that same structural face.
- `Caboose_RearSeatPlinth` replaces the narrower rear seat plank. It is a full 1.960 units wide,
  rises directly from the continuous charcoal caboose body, and spans from the bulkhead's rear
  face at `Z=-2.360` to the existing `Z=-3.200` caboose endpoint beneath Passenger 2's hips. The
  red cushion remains inset upholstery on top. Rider sockets, wheel positions, coupling, width,
  and overall length are unchanged, and no floor extends beneath Passenger 2's hanging legs.
- The rear cushion now starts at the shared bulkhead's `Z=-2.360` rear face and ends at the same
  inset `Z=-3.170` endpoint as before. This fills the former 0.210 empty strip at the front of the
  perch and supports the frozen Passenger 2 hip position without moving the rider, changing the
  caboose footprint, or putting structure beneath the hanging legs.
- All three rider positions now use the same toy-seat vocabulary: a raised rounded oxblood seat
  cushion on a charcoal structural base plus a raised rounded oxblood back cushion. Cushion forms use
  shallow two-segment bevels, 0.140 corner radii, and visibly thicker 0.100/0.120 seat/back masses
  instead of flat pads. Passenger 2 receives a cushion on the rear face of the shared bulkhead,
  so that wall now supports both riders as a two-sided upholstered backrest. All rider sockets and
  their rotations remain unchanged.
- The controlled cohesion palette assigns near-black painted wood to primary body and pod
  surfaces, crimson only to chassis/frame reinforcement and compartment top caps, oxblood to all
  six upholstered seat surfaces, brass to the bell, and dark iron to mechanical structure and
  wheel hubs. The former passenger-pod face stripes are replaced by slim 0.070-thick top caps that
  match the driver pod and continue across the full-width shared bulkhead.
- `Engine_Bell` replaces the ambiguous yellow cylinder with a flared open-bottom brass cup, stem,
  defined brass mouth rim, dark clapper, and dark mounting foot. Painted wood and upholstery
  remain nonmetallic and rough; brass and dark mechanical iron receive separate metallic response
  instead of relying on color alone. Bell placement stays within the existing locomotive and
  train bounds.
- The readability correction changes palette values only. Main painted wood is `#353D48`,
  structural crimson is `#A33630`, oxblood upholstery is `#64292D`, mechanical iron is
  `#252A2F`, black-iron tread is `#20252A`, and focal brass is `#BC944A`. Geometry, material
  assignments, PBR response, rider transforms, and the measured train envelope are unchanged.
- The stronger preview-readability correction lifts painted wood to `#505D70`, structural crimson
  to `#B0443A`, oxblood upholstery to `#7B3C40`, mechanical iron to `#343D47`, and focal brass to
  `#CAA04E`; true near-black remains limited to `#20252A` wheel tread and tiny separation parts.
  The smokestack mouth is reassigned from mechanical iron to the same painted-wood material as its
  body. No geometry, transforms, trim placement, PBR scalars, or measured bounds change.
- The mechanical cleanup lifts gunmetal to `#3A434D` and reserves `#20252A` near-black for tire
  treads and tiny crank pins. Wheel hubs, steam-cylinder bodies, cylinder mounts, crosshead guides,
  guide brackets, underframes, coupling hardware, and other readable mechanical masses use the
  gunmetal material. Crimson remains on the moving linkage and spoke structure. No geometry or
  material-response scalar changes are included.
- Preview review showed high-metalness gunmetal still collapsing in shadow, so the final gunmetal
  value is `#3E4752`. A second side-view check set its final response to roughness `0.62` and
  metalness `0.22`, modeling rough blackened iron with a visible diffuse base rather than polished
  metal that reflects the dark environment. Geometry remains unchanged.
- The value-hierarchy pass lifts body paint to `#5B687A`, gunmetal to `#46515D`, and upholstery to
  `#88484C`, while muting structural crimson to `#A44037`. The existing locomotive front cylinder
  is reassigned from broad crimson fill to gunmetal, removing the placeholder red-disc read without
  adding or changing geometry. Brass and near-black roles remain restricted as before.
- The inverted hierarchy pass sets upper painted bodywork and the entire smokestack to dark navy
  `#2D3D56`, visible running gear to medium gunmetal `#626C76`, upholstery to `#784045`, and tire
  treads plus tiny crank pins to `#1B1F24`. The locomotive front face returns to the painted-body
  family, removing the disconnected gunmetal-snout read. Crimson remains `#A44037` and brass
  remains `#CAA04E`. Geometry and transforms remain unchanged.
- The upper painted bodywork and smokestack are returned to the earlier readable blue-charcoal
  `#505D70` at user review. The light `#626C76` running gear and every other material assignment,
  response scalar, geometry value, and transform remain unchanged.
- The locomotive cleanup enlarges `Engine_Bell` to a 0.560-wide flared brass cup and raises it so
  the cup clears the boiler in side view. A simple full-width gunmetal yoke, paired posts, and feet
  make its support readable in side and three-quarter views while staying below the smokestack's
  existing top plane. `Engine_BoilerRearCollar` adds one thin gunmetal torus at the boiler-to-pod
  transition, turning the former accidental seam into a deliberate construction joint. Riders,
  wheels, caboose, coupling, palette, and primary locomotive proportions remain unchanged.
- Bell review trims the yoke crossbar and posts so they frame rather than obscure the cup. Brass
  keeps `#CAA04E` but uses roughness `0.44` and metalness `0.38`, preserving a warm metal response
  while exposing its base color under the dark authoring environment.
- Wheel center hubs use a dedicated `#343B45` charcoal material with roughness `0.68` and
  metalness `0.28`. This provides contrast against both crimson spokes and light gunmetal running
  gear without using the near-black tire material. Wheel geometry and all transforms are unchanged.

## Evidence

- `rider-fit-three-quarter.png`
- `rider-fit-front.png`
- `rider-fit-side.png`
- `rider-fit-top.png`
- `measurements.json`
- `comparison.png`

All evidence is under `docs/screenshots/wooden-toy-train/authoring/blockout/`.

The multi-angle diagnostic reports no degenerate view. The strict sculpt specification passes.

The deterministic `train2.png` concept-to-render Tier 1 diagnostic remains red only on silhouette
IoU at 0.579. Aspect-ratio delta is 0.013 and scale delta is 0.014, both now within threshold. The
source includes finished detail, lighting, labels, inset views, and a different composition, while
this pass intentionally contains only primitive fit geometry. This result is recorded, not
overridden. No detailed locomotive or caboose work may begin until the blockout is reviewed and
either refined or explicitly accepted for its fit-and-scale purpose.

## Review questions

- Does the train feel narrow and toy-sized enough relative to the riders?
- Is the driver close enough behind the boiler without losing torso visibility?
- Does Passenger 1 have enough separation from the rear-facing passenger?
- Does Passenger 2's exposed pose and hanging-leg clearance read correctly?
- Is the engine-to-caboose mass ratio suitable to lock for the detailed stages?
