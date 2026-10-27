<template>
  <div class="vtl" :class="{ 'vtl-drag-source': isDragSource }" v-on="treeListeners">
    <vtl-drop-ghost v-if="dropPosition === 'before'" v-bind="ghostProps()" />

    <div
      v-if="model.name !== 'root'"
      :id="model.id"
      class="vtl-node"
      :class="{ 'vtl-leaf-node': model.isLeaf, 'vtl-tree-node': !model.isLeaf }"
    >
      <div
        :class="treeNodeClass"
        :draggable="!model.dragDisabled"
        @dragstart="dragStart"
        @dragover="dragOver"
        @dragend="dragEnd"
        @mouseover="mouseOver"
        @mouseout="mouseOut"
        @click.stop="click"
      >
        <span class="vtl-caret vtl-is-small" v-show="model.children && model.children.length > 0">
          <i class="vtl-icon" :class="caretClass" @click.prevent.stop="toggle"></i>
        </span>

        <span v-if="model.isLeaf">
          <slot name="leafNodeIcon" :expanded="expanded" :model="model" :root="rootNode">
            <i class="vtl-icon vtl-menu-icon vtl-icon-file"></i>
          </slot>
        </span>
        <span v-else>
          <slot name="treeNodeIcon" :expanded="expanded" :model="model" :root="rootNode">
            <i class="vtl-icon vtl-menu-icon vtl-icon-folder"></i>
          </slot>
        </span>

        <div class="vtl-node-content" v-if="!editable">
          <slot name="leafNameDisplay" :expanded="expanded" :model="model" :root="rootNode">
            {{ model.name }}
          </slot>
        </div>
        <input
          v-else
          class="vtl-input"
          type="text"
          ref="nodeInput"
          :value="model.name"
          @input="updateName"
          @blur="setUnEditable"
          @keyup.enter="setUnEditable"
        />
        <div class="vtl-operation" v-show="isHover">
          <span
            :title="defaultAddTreeNodeTitle"
            @click.stop.prevent="addChild(false)"
            v-if="!model.isLeaf && !model.addTreeNodeDisabled"
          >
            <slot name="addTreeNodeIcon" :expanded="expanded" :model="model" :root="rootNode">
              <i class="vtl-icon vtl-icon-folder-plus-e"></i>
            </slot>
          </span>
          <span
            :title="defaultAddLeafNodeTitle"
            @click.stop.prevent="addChild(true)"
            v-if="!model.isLeaf && !model.addLeafNodeDisabled"
          >
            <slot name="addLeafNodeIcon" :expanded="expanded" :model="model" :root="rootNode">
              <i class="vtl-icon vtl-icon-plus"></i>
            </slot>
          </span>
          <span title="edit" @click.stop.prevent="setEditable" v-if="!model.editNodeDisabled">
            <slot name="editNodeIcon" :expanded="expanded" :model="model" :root="rootNode">
              <i class="vtl-icon vtl-icon-edit"></i>
            </slot>
          </span>
          <span title="delete" @click.stop.prevent="delNode" v-if="!model.delNodeDisabled">
            <slot name="delNodeIcon" :expanded="expanded" :model="model" :root="rootNode">
              <i class="vtl-icon vtl-icon-trash"></i>
            </slot>
          </span>
        </div>
      </div>
    </div>

    <vtl-drop-ghost v-if="dropPosition === 'into'" v-bind="ghostProps()" />

    <div
      :class="{ 'vtl-tree-margin': model.name !== 'root' }"
      v-show="model.name === 'root' || expanded"
      v-if="isFolder"
    >
      <item
        v-for="model in model.children"
        :default-tree-node-name="defaultTreeNodeName"
        :default-leaf-node-name="defaultLeafNodeName"
        :default-expanded="model.expanded ? true : defaultExpanded"
        :model="model"
        :key="model.id"
      >
        <template v-slot:leafNameDisplay="slotProps">
          <slot name="leafNameDisplay" v-bind="slotProps" />
        </template>
        <template v-slot:addTreeNodeIcon="slotProps">
          <slot name="addTreeNodeIcon" v-bind="slotProps" />
        </template>
        <template v-slot:addLeafNodeIcon="slotProps">
          <slot name="addLeafNodeIcon" v-bind="slotProps" />
        </template>
        <template v-slot:editNodeIcon="slotProps">
          <slot name="editNodeIcon" v-bind="slotProps" />
        </template>
        <template v-slot:delNodeIcon="slotProps">
          <slot name="delNodeIcon" v-bind="slotProps" />
        </template>
        <template v-slot:leafNodeIcon="slotProps">
          <slot name="leafNodeIcon" v-bind="slotProps" />
        </template>
        <template v-slot:treeNodeIcon="slotProps">
          <slot name="treeNodeIcon" v-bind="slotProps" />
        </template>
        <template v-slot:footer="slotProps">
          <slot name="footer" v-bind="slotProps" />
        </template>
      </item>
    </div>

    <div v-if="model.name !== 'root' && expanded">
      <slot name="footer" :expanded="expanded" :model="model"> </slot>
    </div>

    <vtl-drop-ghost v-if="dropPosition === 'after'" v-bind="ghostProps()" />
  </div>
</template>

<script>
import { TreeNode } from './Tree.js'
import { removeHandler } from './tools.js'
import VtlDropGhost from './DropGhost.js'
import { defaults } from './defaults.js'

// One drag at a time across every tree on the page, so a node can be dragged
// from one tree into another. The drop state lives on the two rows involved
// (the dragged one and the current target), so hovering re-renders only those.
// Invariant: a target is only set while sourceComp is set, so clear the target first.
let sourceComp = null
let targetComp = null

function setTarget(comp, position) {
  if (targetComp && targetComp !== comp) targetComp.dropPosition = null
  targetComp = comp
  comp.dropPosition = position
}

function clearTarget() {
  if (targetComp) targetComp.dropPosition = null
  targetComp = null
}

function resetDrag() {
  clearTarget()
  if (sourceComp) sourceComp.isDragSource = false
  sourceComp = null
}

export default {
  name: 'vue-tree-list-v2',
  components: { VtlDropGhost },
  data: function() {
    return {
      isHover: false,
      editable: false,
      expanded: this.defaultExpanded,
      // 'before' | 'after' | 'into' while this row is the drop target, else null.
      dropPosition: null,
      isDragSource: false
    }
  },
  props: {
    model: {
      type: Object
    },
    defaultLeafNodeName: {
      type: String,
      default: 'Leaf Node'
    },
    defaultTreeNodeName: {
      type: String,
      default: 'Tree Node'
    },
    defaultAddTreeNodeTitle: {
      type: String,
      default: 'Add Tree Node'
    },
    defaultAddLeafNodeTitle: {
      type: String,
      default: 'Add Leaf Node'
    },
    defaultExpanded: {
      type: Boolean,
      default: true
    },
    // Tag text on the drop preview, e.g. { before: 'Before', after: 'After', into: 'Into' }.
    // Read from the root <vue-tree-list>; missing keys fall back to the plugin defaults.
    dropLabels: {
      type: Object,
      default: null
    }
  },
  computed: {
    isRoot() {
      return this.model.name === 'root'
    },

    // Only the root listens for drops: one drop per tree, wherever the pointer is.
    treeListeners() {
      return this.isRoot
        ? { dragover: this.onTreeDragOver, dragleave: this.onTreeDragLeave, drop: this.onTreeDrop }
        : {}
    },

    rootNode() {
      var node = this.$parent
      while (node._props.model.name !== 'root') {
        node = node.$parent
      }
      return node
    },

    caretClass() {
      return this.expanded ? 'vtl-icon-caret-down' : 'vtl-icon-caret-right'
    },

    isFolder() {
      return this.model.children && this.model.children.length
    },

    treeNodeClass() {
      const {
        model: { dragDisabled, disabled },
        dropPosition
      } = this

      return {
        'vtl-node-main': true,
        'vtl-drop-target': dropPosition === 'into',
        'vtl-drag-disabled': dragDisabled,
        'vtl-disabled': disabled
      }
    }
  },
  beforeCreate() {
    this.$options.components.item = require('./VueTreeList').default
  },
  beforeDestroy() {
    removeHandler(window, 'keyup')
    if (sourceComp === this) resetDrag()
    else if (targetComp === this) clearTarget()
  },
  methods: {
    updateName(e) {
      var oldName = this.model.name
      this.model.changeName(e.target.value)
      // eslint-disable-next-line no-console
      console.log('update Name')
      this.rootNode.$emit('change-name', {
        id: this.model.id,
        oldName: oldName,
        newName: e.target.value,
        node: this.model
      })
    },

    delNode() {
      this.rootNode.$emit('delete-node', this.model)
    },

    setEditable() {
      this.editable = true
      this.$nextTick(() => {
        const $input = this.$refs.nodeInput
        $input.focus()
        $input.setSelectionRange(0, $input.value.length)
      })
    },

    setUnEditable(e) {
      if (this.editable === false) return
      this.editable = false
      var oldName = this.model.name
      this.model.changeName(e.target.value)
      this.rootNode.$emit('change-name', {
        id: this.model.id,
        oldName: oldName,
        newName: e.target.value,
        eventType: 'blur'
      })
      this.rootNode.$emit('end-edit', {
        id: this.model.id,
        oldName: oldName,
        newName: e.target.value
      })
    },

    toggle() {
      if (this.isFolder) {
        this.expanded = !this.expanded
      }
    },

    mouseOver() {
      if (this.model.disabled) return
      this.isHover = true
    },

    mouseOut() {
      this.isHover = false
    },

    click() {
      this.rootNode.$emit('click', {
        toggle: this.toggle,
        ...this.model
      })
    },

    addChild(isLeaf) {
      const name = isLeaf ? this.defaultLeafNodeName : this.defaultTreeNodeName
      this.expanded = true
      var node = new TreeNode({ name, isLeaf })
      this.model.addChildren(node, true)
      this.rootNode.$emit('add-node', node)
    },

    ghostProps() {
      const position = this.dropPosition
      if (!position) return {}
      const labels = Object.assign({}, defaults.dropLabels, this.rootNode.dropLabels)
      return {
        node: sourceComp.model,
        position,
        label: labels[position] || '',
        expanded: sourceComp.expanded,
        slots: this.$scopedSlots,
        root: this.rootNode
      }
    },

    dragStart(e) {
      if (this.model.dragDisabled || this.model.disabled) {
        e.preventDefault()
        return
      }
      sourceComp = this
      // for firefox
      e.dataTransfer.setData('data', 'data')
      e.dataTransfer.effectAllowed = 'move'
      // Dim the source on the next tick: the browser takes the drag image after this
      // handler, and a dimmed row would make a faded drag image.
      setTimeout(() => {
        if (sourceComp === this) this.isDragSource = true
      }, 0)
    },

    dragEnd() {
      resetDrag()
    },

    // Where would the dragged node land if dropped at this pointer position on this row?
    // Returns 'before' | 'after' | 'into', or null when the drop is not allowed here.
    getDropPosition(e) {
      const node = sourceComp.model
      const target = this.model
      if (node === target || node.isTargetChild(target)) return null

      const rect = e.currentTarget.getBoundingClientRect()
      const y = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5

      // A leaf cannot take children: upper half goes before it, lower half after it.
      if (target.isLeaf) return y < 0.5 ? 'before' : 'after'
      if (y < 0.25) return 'before'
      // Right under an open parent is its first child's spot, so that also means "into".
      if (y > 0.75 && !(this.isFolder && this.expanded)) return 'after'
      return 'into'
    },

    dragOver(e) {
      if (!sourceComp) return
      const position = this.getDropPosition(e)
      if (!position) {
        clearTarget()
        return
      }
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (targetComp !== this || this.dropPosition !== position) setTarget(this, position)
    },

    // Root only. Keeps the drop allowed while the pointer is over the preview or a gap
    // between rows, so the node lands where the preview shows.
    onTreeDragOver(e) {
      if (!sourceComp || !targetComp || targetComp.rootNode !== this) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },

    // Root only. Hide the preview once the pointer leaves this tree.
    onTreeDragLeave(e) {
      if (!targetComp || targetComp.rootNode !== this) return
      if (e.relatedTarget && !this.$el.contains(e.relatedTarget)) clearTarget()
    },

    // Root only. Applies the move the preview shows and emits the same events as before.
    onTreeDrop(e) {
      if (!sourceComp || !targetComp || targetComp.rootNode !== this) return
      e.preventDefault()
      e.stopPropagation()

      const targetVm = targetComp
      const position = targetVm.dropPosition
      const node = sourceComp.model
      const target = targetVm.model
      const src = node.parent
      resetDrag()

      if (position === 'into') {
        node.moveInto(target)
        targetVm.expanded = true
        this.$emit('drop', { target, node, src })
      } else if (position === 'before') {
        node.insertBefore(target)
        this.$emit('drop-before', { target, node, src })
      } else if (position === 'after') {
        node.insertAfter(target)
        this.$emit('drop-after', { target, node, src })
      }
    }
  }
}
</script>

<style lang="less" rel="stylesheet/less">
@font-face {
  font-family: 'icomoon';
  src: url('fonts/icomoon.eot?ui1hbx');
  src: url('fonts/icomoon.eot?ui1hbx#iefix') format('embedded-opentype'),
    url('fonts/icomoon.ttf?ui1hbx') format('truetype'),
    url('fonts/icomoon.woff?ui1hbx') format('woff'),
    url('fonts/icomoon.svg?ui1hbx#icomoon') format('svg');
  font-weight: normal;
  font-style: normal;
}

.vtl-icon {
  /* use !important to prevent issues with browser extensions that change fonts */
  font-family: 'icomoon' !important;
  speak: none;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  /* Better Font Rendering =========== */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  &.vtl-menu-icon {
    margin-right: 4px;
    &:hover {
      color: inherit;
    }
  }

  &:hover {
    color: blue;
  }
}

.vtl-icon-file:before {
  content: '\e906';
}

.vtl-icon-folder:before {
  content: '\e907';
}

.vtl-icon-caret-down:before {
  content: '\e901';
}

.vtl-icon-caret-right:before {
  content: '\e900';
}

.vtl-icon-edit:before {
  content: '\e902';
}

.vtl-icon-folder-plus-e:before {
  content: '\e903';
}

.vtl-icon-plus:before {
  content: '\e904';
}

.vtl-icon-trash:before {
  content: '\e905';
}

.vtl-node-main {
  display: flex;
  align-items: center;
  padding: 5px 0 5px 1rem;
  .vtl-input {
    border: none;
    max-width: 150px;
    border-bottom: 1px solid blue;
  }

  &:hover {
    background-color: #f0f0f0;
  }

  &.vtl-drop-target {
    background-color: #f0f7ff;
    box-shadow: inset 0 0 0 1px #9cc8ec;
  }

  .vtl-caret {
    margin-left: -1rem;
  }

  .vtl-operation {
    margin-left: 2rem;
    letter-spacing: 1px;
  }
}

.vtl-item {
  cursor: pointer;
}

.vtl-tree-margin {
  margin-left: 2em;
}

.vtl-drag-source {
  opacity: 0.4;
}

// Drop preview: the dragged row, shown where it will land.
.vtl-drop-ghost {
  pointer-events: none;
  margin: 2px 0;
  // An inset bar, not a border, so the text lines up with the real rows.
  box-shadow: inset 4px 0 0 #3e8ed0;
  border-radius: 0 4px 4px 0;
  background-color: #eef6fc;
  color: #1f5f8f;

  .vtl-drop-tag {
    flex-shrink: 0;
    align-self: center;
    margin: 0 6px 0 auto;
    padding: 0 8px;
    border-radius: 10px;
    background-color: #3e8ed0;
    color: #fff;
    font-size: 11px;
    line-height: 1.6;
    white-space: nowrap;
  }
}
</style>
