# Her looks

Each look is one head-base image (300 x 363 WebP), made in the Workshop (catalog/workshop.html, "Narrator looks"):
new hair and accessories over her original face, jaw, eyes and neck. List it in ../looks.json:

    { "name": "halloween", "file": "halloween.webp", "from": "10-20", "to": "10-31", "bulb": false }
    { "name": "crimped", "file": "crimped.webp", "rotate": true }

`from`/`to` are month-day and may wrap the new year; `rotate` looks take turns with her curls on other days;
`bulb: false` when a hat or bow covers the antenna. `?look=name` previews one.
