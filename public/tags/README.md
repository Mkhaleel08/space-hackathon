# AprilTag labels (owner: product)

AprilTag 36h11 markers, one per component. The tag carries only a number;
`src/lib/markers.ts` maps it to the component id. Ids 0-3 are the Cat 320,
10-13 the demo car.

The live tag map is the `tags` table (see `/api/tags`); the operator
dashboard at `/dashboard` adds parts, assigns the next free id, and prints
labels from `/labels`. The files here are the original static set.

Print `/tags/print.html` (or `/labels`) on matte paper at 100% scale (60 mm tags). The
white border around each tag is part of the marker, do not trim inside it.
Detection needs the tag to be at least ~60 px wide in the camera frame, so
a 60 mm tag works from about 1.5 m on a phone.

The QR labels under `/qr/` still work with the same live view as a fallback.
