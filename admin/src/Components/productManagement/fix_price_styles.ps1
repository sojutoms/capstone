
$filePath = 'c:\Users\Administrator\Downloads\FinalProject\FinalProject\admin\src\Components\productManagement\productManagement.css'
$content = Get-Content $filePath

$newStyles = @"

/* ── Price Row Compact Luxe ── */
.price-row-luxe {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 64px;
    position: relative;
    box-sizing: border-box;
}

.price-row-luxe.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent-white);
    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.05);
}

.row-size {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 900;
    color: var(--text-primary);
    min-width: 48px;
    border-right: 1px solid var(--border-subtle);
    padding-right: 12px;
    flex-shrink: 0;
}

.row-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 100px;
    flex: 1;
}

.row-stock {
    font-size: 10px;
    font-weight: 800;
    color: #4ade80;
    text-transform: uppercase;
}

.row-current {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-secondary);
}

.row-input {
    min-width: 120px;
}
"@

# Write back without the old definitions
$cleanContent = $content | Where-Object { $_ -notmatch 'price-row-luxe' -and $_ -notmatch 'row-size' -and $_ -notmatch 'row-meta' -and $_ -notmatch 'row-stock' -and $_ -notmatch 'row-current' -and $_ -notmatch 'row-input' }
$cleanContent | Set-Content ($filePath + ".tmp")
Add-Content ($filePath + ".tmp") -Value $newStyles
Move-Item -Force ($filePath + ".tmp") $filePath
