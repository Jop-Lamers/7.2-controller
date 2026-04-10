<!doctype html>
<html lang="nl">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Controller</title>
    <link rel="stylesheet" href="styles.css" />
</head>

<body class="controller-page">
    <main class="controller-layout panel">
        <h1>Kermis Controller</h1>
        <p>
            Gebruik deze pagina om de grijpmachine in de andere tab live te
            besturen.
        </p>

        <div class="joystick" id="joystick" aria-label="Joystick links rechts">
            <div class="joystick-track">
                <div class="joystick-knob" id="joystickKnob"></div>
            </div>
        </div>

        <div class="actions">
            <button data-action="grab" class="btn action grab">Grijp</button>
            <button data-action="release" class="btn action release">Laat vallen</button>
        </div>

        <small class="hint">Schuif de pook links/rechts en druk op GRIJP voor je beurt.</small>
    </main>

    <script src="controller.js?v=<?php echo urlencode((string) @filemtime(__DIR__ . '/controller.js')); ?>"></script>
</body>

</html>