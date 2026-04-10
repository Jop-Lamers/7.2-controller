<!doctype html>
<html lang="nl">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Grijpmachine</title>
    <link rel="stylesheet" href="styles.css" />
</head>

<body class="machine-page">
    <main class="machine-layout">
        <header class="panel">
            <h1>Kermis Grijpmachine</h1>
            <p>
                Open ook
                <a href="controller.php" target="_blank" rel="noopener">controller.php</a>
                om de machine te besturen.
            </p>
            <div class="status-row">
                <span id="connectionStatus" class="pill">Luistert naar controller...</span>
                <span id="turnsStatus" class="pill">Beurten over: 3/3</span>
                <span id="scoreStatus" class="pill">Gewonnen: €0 (0)</span>
            </div>
        </header>

        <section class="machine-stage panel">
            <canvas
                id="machineCanvas"
                width="1120"
                height="700"
                aria-label="Grijpmachine"></canvas>
        </section>
    </main>

    <section id="roundModal" class="round-modal" hidden>
        <div class="round-modal__card panel" role="dialog" aria-modal="true" aria-labelledby="roundModalTitle">
            <h2 id="roundModalTitle">Beurten op</h2>
            <p id="roundModalMessage">Je hebt 3 beurten gebruikt.</p>
            <button id="newRoundButton" class="round-buy-btn" type="button" disabled>
                Nieuwe ronde starten voor €30
            </button>
        </div>
    </section>

    <script src="machine.js?v=<?php echo urlencode((string) @filemtime(__DIR__ . '/machine.js')); ?>"></script>
</body>

</html>