const ObjectID    = require("mongodb").ObjectID;
const {connect}   = require('mm')

module.exports = async (dbName='shop-roles') => {
    const {Savable, slice} = await connect(dbName)

    async function getModels({id, acl}){
        const SlicedSavable = slice(id === 'anon' ? [id] : [...acl])

        class User extends SlicedSavable {
            constructor(...params){
                super(...params)

                this.originalACL = this.acl && [...this.acl]
            }

            async save(...params){
                console.log(this)
                let otherUserWithThisLogin = this.login && await Savable.m.User.findOne({login: this.login})
                if (this._id){
                    if (otherUserWithThisLogin && otherUserWithThisLogin._id.toString() !== this._id.toString()){
                        throw new ReferenceError(`User ${this.login} already exists`)
                    }
                    if (!acl.includes('admin') && this.originalACL.toString() !== this.acl.toString())
                        throw new ReferenceError(`Not enough permissions for changing acl on ${this.login}`)
                    else return await super.save(...params)
                }
                else {
                    if (otherUserWithThisLogin){
                        throw new ReferenceError(`User ${this.login} already exists`)
                    }
                    await super.save(...params)
                    this.___owner = this._id.toString()
                    this.acl      = [this.___owner, "user"]
                    return await Savable.prototype.save.call(this, ...params)
                }
            }

            static get relations(){ //don't needed due to ___owner in most cases
                return {
                    avatar : "userAvatar",
                }
            }

            static get defaultPermissions(){
                return {
                    create: ['anon'],
                    read: ['owner', 'user', 'admin'],
                    write: ['owner', 'admin'],
                    delete: []
                }
            }

            async getACL(){
                return [this._id.toString(), "user"]
            }
        }
        SlicedSavable.addClass(User)

        class OwnerSlicedSavable extends SlicedSavable {
            get owner(){
                if (!this.___owner) return this.___owner

                return SlicedSavable.m.User.findOne({_id: ObjectID(this.___owner)})
            }
        }


        class Image extends OwnerSlicedSavable {
            constructor(...params){
                super(...params)
            }


            static async fromFileData(fileData){
		    if (!fileData) return
                let image  = new Image({})
                image.fileData = fileData
                image.url      = `images/${fileData.filename}`
                image.originalFileName = fileData.originalname
                await image.save()
                return image;
            }

            async save(...params){
                if (this.userAvatar){
                    if (this.userAvatar._id.toString() !== id){
                        throw new ReferenceError(`You can't set ava for other user`)
                    }
                }

                return await super.save(...params)
            }

            static get relations(){
                return {
                    userAvatar: "avatar", //if it is ava
                    good: ["images"], //if it is ava
                    category: "image", //if it is ava
                }
            }

            static get defaultPermissions(){
                return {
                    create: ['user', 'admin'],
                    read: ['anon', 'user', 'admin'],
                    write: ['admin'],
                    delete: ['admin']
                }
            }

        }
        SlicedSavable.addClass(Image)

        class Good extends OwnerSlicedSavable {
            constructor(...params){
                super(...params)
            }

            static get relations(){
                return {
                    categories: ["goods"],
                    orderGoods: "good",
                    images: "good"
                }
            }

            static get defaultPermissions(){
                return {
                    create: ['admin'],
                    read: ['anon', 'user', 'admin'],
                    write: ['admin'],
                    delete: ['admin']
                }
            }

            static get guestRelations(){
                return ['orderGoods']
            }
        }
        SlicedSavable.addClass(Good)

        class Category extends SlicedSavable {
            constructor(...params){
                super(...params)
            }

            static get relations(){
                return {
                    goods: ["categories"],
                    image: "category",
                    parent: ["subCategories"],
                    subCategories: "parent"
                }
            }

            static get defaultPermissions(){
                return {
                    create: ['admin'],
                    read: ['anon', 'user', 'admin'],
                    write: ['admin'],
                    delete: ['admin']
                }
            }
        }
        SlicedSavable.addClass(Category)

        class Order extends OwnerSlicedSavable {
            constructor(...params){
                super(...params)
            }

            get total(){
                return (async() => (await Promise.all(this.orderGoods)).reduce((a,b) => (a.total || a) + b.total, 0))()
            }

            static get relations(){
                return {
                    orderGoods: "order"
                }
            }


            static get defaultPermissions(){
                return {
                    //savable refs, objectid's, words like 'tags' or 'roles'
                    read:   ['owner', 'admin'],
                    write:  ['owner', 'admin'],
                    create: ['user'],
                    delete: [],

                    /*permission
                     * TODO: permissions for read and write permissions
                     *
                     */
                }
            }
        }
        SlicedSavable.addClass(Order)

        class OrderGood extends OwnerSlicedSavable {
            constructor(...params){
                super(...params)
            }

            get total(){
                return this.price*this.count
            }

            async save(...params){
                if (!this.price && this.good && this.good.price){
                    this.price = this.good.price
                }
                return await super.save(...params)
            }

            static get relations(){
                return {
                    good: ["orderGoods"],
                    order: ["orderGoods"]
                }
            }


            static get defaultPermissions(){
                return {
                    //savable refs, objectid's, words like 'tags' or 'roles'
                    read:   ['owner', 'admin'],
                    write:  ['owner', 'admin'],
                    create: ['user'],
                    delete: [],

                    /*permission
                     * TODO: permissions for read and write permissions
                     *
                     */
                }
            }
        }
        SlicedSavable.addClass(OrderGood)



        const thisUser = id !== 'anon' && await Savable.m.User.findOne({_id: ObjectID(id)})



        return {models: {
                            SlicedSavable, ...SlicedSavable.classes
                        }, 
                thisUser}
    }

    return {
        Savable, 
        slice,
        getModels
    }
}


