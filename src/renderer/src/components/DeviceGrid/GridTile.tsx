interface GridTileProps {
  tileNumber: string
  buttonId: string        // e.g. "B0", "B1", or "—" for placeholder
  pressed: boolean
  connected: boolean      // whole-device connection state
  unavailable?: boolean   // no HID button behind this tile
  mappedKey?: string
  editMode?: boolean
  onClick?: () => void
  onDragStart?: () => void
  onDrop?: () => void
}

export function GridTile({
  tileNumber,
  buttonId,
  pressed,
  connected,
  unavailable = false,
  mappedKey,
  editMode = false,
  onClick,
  onDragStart,
  onDrop,
}: GridTileProps) {
  const isClickable = !!onClick && !unavailable && !editMode
  const isDraggable = editMode && !unavailable && !!onDragStart

  // Status dot colour
  const dotClass = unavailable
    ? 'bg-(--border)'
    : !connected
      ? 'bg-(--danger)'
      : pressed
        ? 'bg-(--accent)'
        : 'bg-(--success)'

  // Card border + background
  let cardClass: string
  if (unavailable) {
    cardClass = 'opacity-25 border-(--border) bg-(--bg-card) cursor-default'
  } else if (!connected) {
    cardClass = 'border-(--danger)/30 bg-(--danger)/5'
  } else if (pressed) {
    cardClass = 'bg-(--accent)/20 border-(--accent)'
  } else if (editMode) {
    cardClass = 'bg-(--bg-card) border-(--border) border-dashed cursor-grab active:cursor-grabbing hover:border-(--accent)/50'
  } else if (isClickable) {
    cardClass = 'bg-(--bg-card) border-(--border) cursor-pointer hover:border-(--accent)/60 hover:bg-(--bg-hover)'
  } else {
    cardClass = 'bg-(--bg-card) border-(--border)'
  }

  return (
    <div
      draggable={isDraggable}
      onClick={isClickable ? onClick : undefined}
      onDragStart={
        isDraggable
          ? (e) => {
              e.dataTransfer.effectAllowed = 'move'
              onDragStart!()
            }
          : undefined
      }
      onDragOver={onDrop ? (e) => e.preventDefault() : undefined}
      onDrop={
        onDrop
          ? (e) => {
              e.preventDefault()
              onDrop()
            }
          : undefined
      }
      className={[
        'aspect-square rounded-xl flex flex-col items-start justify-between p-2.5 select-none transition-all duration-75 border',
        cardClass,
      ].join(' ')}
      style={
        pressed && !unavailable
          ? { boxShadow: '0 0 18px 5px rgba(99, 102, 241, 0.5)' }
          : undefined
      }
    >
      {/* Top row — status dot + button ID */}
      <div className="flex items-center justify-between w-full">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
        <span className="text-[9px] font-mono text-(--text-muted) opacity-50 leading-none">
          {buttonId}
        </span>
      </div>

      {/* Centre — tile number */}
      <div className="flex-1 flex items-center justify-center w-full">
        <span
          className={`text-xl font-bold leading-none ${
            unavailable
              ? 'text-(--text-muted)'
              : pressed
                ? 'text-(--accent)'
                : !connected
                  ? 'text-(--danger)/40'
                  : 'text-(--text-muted)'
          }`}
        >
          {tileNumber}
        </span>
      </div>

      {/* Bottom — mapped key */}
      <div className="w-full h-3.5 flex items-center justify-center">
        {mappedKey && (
          <span
            className={`text-[9px] font-mono leading-none truncate max-w-full ${
              pressed ? 'text-(--accent)' : 'text-(--accent)/60'
            }`}
          >
            {mappedKey}
          </span>
        )}
      </div>
    </div>
  )
}
