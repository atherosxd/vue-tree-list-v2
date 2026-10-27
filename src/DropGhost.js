/**
 * Drop preview shown while dragging: a copy of the dragged node's row, rendered
 * with the tree's own slots, at the spot where the node will land.
 */
const ARROWS = {
  before: '↑',
  after: '↓',
  into: '↳'
}

// A scoped slot returns undefined when the consumer did not provide it.
function renderSlot(slot, props, fallback) {
  const nodes = slot && slot(props)
  return nodes || fallback
}

export default {
  name: 'vtl-drop-ghost',
  functional: true,
  props: {
    node: { type: Object, required: true },
    position: { type: String, required: true },
    label: { type: String, default: '' },
    expanded: { type: Boolean, default: false },
    slots: { type: Object, default: () => ({}) },
    root: { type: Object, default: null }
  },
  render(h, { props }) {
    const { node, position, label, expanded, slots, root } = props
    const slotProps = { expanded, model: node, root }
    const hasChildren = !!(node.children && node.children.length)

    const caret = hasChildren
      ? h('span', { class: 'vtl-caret vtl-is-small' }, [
          h('i', { class: ['vtl-icon', expanded ? 'vtl-icon-caret-down' : 'vtl-icon-caret-right'] })
        ])
      : null

    const icon = node.isLeaf
      ? renderSlot(slots.leafNodeIcon, slotProps, [
          h('i', { class: 'vtl-icon vtl-menu-icon vtl-icon-file' })
        ])
      : renderSlot(slots.treeNodeIcon, slotProps, [
          h('i', { class: 'vtl-icon vtl-menu-icon vtl-icon-folder' })
        ])

    // The preview sits between the target's own unkeyed divs. Without a key, Vue's diff
    // pairs it with one of them when the position changes, and moves that row's
    // elements and slot components into the preview (or the reverse).
    const key = 'vtl-drop-ghost-' + position
    const ghost = h(
      'div',
      {
        key,
        class: ['vtl-node-main', 'vtl-drop-ghost', 'vtl-drop-ghost--' + position],
        attrs: { 'aria-hidden': 'true' }
      },
      [
        caret,
        h('span', icon),
        h(
          'div',
          { class: 'vtl-node-content' },
          renderSlot(slots.leafNameDisplay, slotProps, node.name)
        ),
        h('span', { class: 'vtl-drop-tag' }, (ARROWS[position] + ' ' + label).trim())
      ]
    )

    // A child lands one level deeper, so indent it like the target's children.
    return position === 'into' ? h('div', { key, class: 'vtl-tree-margin' }, [ghost]) : ghost
  }
}
