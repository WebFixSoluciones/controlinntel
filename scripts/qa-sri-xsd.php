<?php
// Validates local signed fixtures against the unmodified official SRI schemas.
// Usage: php scripts/qa-sri-xsd.php <xml-directory> <schema-directory>
if ($argc !== 3) { fwrite(STDERR, "Expected XML and schema directories.\n"); exit(2); }
libxml_use_internal_errors(true);
$schemas = [
    'factura' => 'factura_V1.1.0.xsd',
    'nota_credito' => 'NotaCredito_V1.1.0.xsd',
    'nota_debito' => 'NotaDebito_V1.0.0.xsd',
    'guia_remision' => 'GuiaRemision_V1.1.0.xsd',
    'retencion' => 'ComprobanteRetencion_V2.0.0.xsd',
];
$results = [];
foreach ($schemas as $kind => $name) {
    libxml_clear_errors();
    $xml = rtrim($argv[1], '/\\') . DIRECTORY_SEPARATOR . $kind . '.xml';
    $schema = rtrim($argv[2], '/\\') . DIRECTORY_SEPARATOR . $kind . DIRECTORY_SEPARATOR . $name;
    if (!is_file($xml) || !is_file($schema)) { fwrite(STDERR, "Missing fixture/schema for $kind.\n"); exit(2); }
    $doc = new DOMDocument();
    $loaded = $doc->load($xml, LIBXML_NONET);
    $valid = $loaded && $doc->schemaValidate($schema);
    $errors = array_values(array_map(fn($error) => trim($error->message), array_filter(libxml_get_errors(), fn($error) => $error->level >= LIBXML_ERR_ERROR)));
    $results[] = ['kind' => $kind, 'schema' => $name, 'valid' => $valid, 'errors' => $errors];
}
$passed = !in_array(false, array_column($results, 'valid'), true);
echo json_encode(['passed' => $passed, 'results' => $results], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
exit($passed ? 0 : 1);
