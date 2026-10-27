/**
 * Plugin-wide defaults. Override once with Vue.use(VueTreeList, { dropLabels: { ... } }),
 * or per tree with the drop-labels prop.
 */
export const defaults = {
  dropLabels: {
    before: 'Before',
    after: 'After',
    into: 'Into'
  }
}
