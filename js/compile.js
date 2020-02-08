function Compile(el, vm) {
    this.$vm = vm;
    this.$el = this.isElementNode(el) ? el : document.querySelector(el);

    if(this.$el){
        this.$fragment = this.node2Fragment(this.$el);

        //初始化
        this.init();
        this.$el.appendChild(this.$fragment);
    }

}

Compile.prototype = {
    constructor: Compile,
    node2Fragment: function(el) {
        var fragment = document.createDocumentFragment(), //创建文档碎片
        child;

        //将原生节点拷贝到fragment,这段的逻辑是如果el上还有子元素，就将它append到创建的文档碎片，类似虚拟拷贝
        while (child = el.firstChild) {
            fragment.appendChild(child);
        }
        return fragment;
    },

    init: function() {
        //将拷贝后的文档碎片单做参数传入compileElement
        this.compileElement(this.$fragment);
    },

    compileElement: function(el) {
        var childNodes = el.childNodes,
            me = this;
            
        [].slice.call(childNodes).forEach(function(node) {
            var text = node.textContent;
            var reg = /\{\{(.*)\}\}/;
            //如果是元素节点
            if(me.isElementNode(node)) {
                me.compile(node)
            }else if(me.isTextNode(node) && reg.test(text)) {
                me.compileText(node, RegExp.$1.trim());
            }

            if(node.childNodes && node.childNodes.length) {
                me.compileElement(node);
            }

            
        })    
    },

    compile: function(node) {
        var nodeAttrs = node.attributes,
            me = this;
        [].slice.call(nodeAttrs).forEach(function(attr){
            var attrName = attr.name;
            //如果是自定义的例如v-if
            if(me.isDirective(attrName)) {
                var exp = attr.value; //自定义属性值
                var dir = attrName.substring(2); //取-后面的名字，例如on
                //如果是是事件指令
                if(me.isEventDirective(dir)) {
                    compileUtil.eventHandler(node, me.$vm, exp, dir); 
                } else {
                    //普通指令
                    compileUtil[dir] && compileUtil[dir](node, me.$vm, exp);
                }

                node.removeAttribute(attrName);
            }
        })    

    },

    compileText: function(node, exp) {
        compileUtil.text(node,this.$vm,exp);
    },

    isDirective: function(attr) {
        return attr.indexOf('v-') == 0;
    },

    isEventDirective: function(dir) {
        return dir.indexOf('on') === 0;
    },

    //是否为元素节点
    isElementNode: function(node) {
        return node.nodeType == 1;
    },

    isTextNode: function(node) {
        return node.nodeType == 3;
    }


}

//指令处理集合
var compileUtil = {

    text: function(node,vm,exp) {
        this.bind(node,vm,exp, 'text');
    },

    html: function(node, vm, exp) {
        this.bind(node, vm, exp, 'html');
    },

    class: function(node, vm, exp) {
        this.bind(node, vm, exp, 'class');
    },


    model: function(node, vm, exp) {
        this.bind(node, vm, exp, 'model');

        var me = this,
            val = this._getVMVal(vm, exp);
        node.addEventListener('input',function(e){
            var newValue = e.target.value;
            if(val === newValue) {
                return;
            }
            me._setVMVal(vm, exp, newValue);
            val = newValue;
        })    

    },

   //通过v-bind:class="hh"  这样绑定的自定义属性,exp是value,dir为名字例如class
    bind: function(node, vm, exp, dir) {
        //update是定义的一系列更新方法
        var updateFn = updater[dir + 'Updater'];
        //更新方法，将最新的值替换掉老值
        updateFn && updateFn(node,this._getVMVal(vm,exp));

        //绑定回调
        new Watcher(vm,exp,function(value, oldValue) {
            console.log('value',value);
            console.log('oldvalue',oldValue);
            updateFn && updateFn(node,value,oldValue);
        })
        
    },

    //事件处理
    eventHandler: function(node, vm, exp, dir) {
        //去取事件类型，例如v-on:click 里的click
        var eventType = dir.split(':')[1],
        fn = vm.$options.methods && vm.$options.methods[exp];
        //去取绑定的方法 ,如果options参数的里方法有，去取这个方法，exp是属性值

        if(eventType && fn) {
            node.addEventListener(eventType, fn.bind(vm), false);
        }

    },

     //这个方法有点隐晦，实际上试为了去取nm.data里的数据，通过split将exp值转为数组，然后遍历，通过这个值出去data里的真正值
    _getVMVal: function(vm, exp) {
       var val = vm;
       exp = exp.split('.');
       exp.forEach(function(k) {
           val = val[k];
       });
       return val;
    },

    _setVMVal: function(vm, exp, value) {
        var val = vm;
        exp = exp.split('.');
        exp.forEach(function(k,i) {
            if(i < exp.length - 1){
                val = val[k];
            } else {
                val[k] = value;
            }
        })
    }
}

var updater = {
    textUpdater: function(node, value) {
        node.textContent = typeof value == 'undefined' ? '' : value;
    },

    htmlUpdater: function(node,value) {
        node.innerHTML = typeof value == 'undefined' ? '' : value;
    },

    classUpdater: function(node, value, oldValue) {
        var className = node.className;
        //将原来的className里的老的删除
        className = className.replace(oldValue,'').replace(/\s$/,'');
        //如果value为有值，都转为' '，否则转为''
        var space = className && String(value) ? ' ':'';
        //价格classname进行拼接
        node.className = className + space + value;
    },

    modelUpdater: function(node, value, oldValue) {
        node.value = typeof value == 'undefined' ? '' : value;
    }
}