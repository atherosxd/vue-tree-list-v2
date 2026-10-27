/**
 * Created by ayou on 17/7/21.
 */

import VueTreeList from './VueTreeList'
import { Tree, TreeNode } from './Tree'
import { defaults } from './defaults'

VueTreeList.install = (Vue, options = {}) => {
  if (options.dropLabels) {
    Object.assign(defaults.dropLabels, options.dropLabels)
  }
  Vue.component(VueTreeList.name, VueTreeList)
}

export default VueTreeList
export { Tree, TreeNode, VueTreeList }
