/**
 * 数据库适配器
 * 统一封装Sequelize操作，简化数据库调用
 */

require('dotenv').config();
const models = require('../models');

// 分页参数默认值和上限
const PAGINATION_DEFAULTS = {
    page: 1,
    pageSize: 20,
    maxPageSize: 100
};

/**
 * 解析分页参数，添加上限限制
 */
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || PAGINATION_DEFAULTS.page);
    const pageSize = Math.min(
        PAGINATION_DEFAULTS.maxPageSize,
        Math.max(1, parseInt(query.pageSize) || PAGINATION_DEFAULTS.pageSize)
    );
    return { page, pageSize, offset: (page - 1) * pageSize };
}

class DbAdapter {
    static async findAll(model, options = {}) {
        return await model.findAll(options);
    }

    static async findOne(model, options = {}) {
        return await model.findOne(options);
    }

    static async findByPk(model, pk, options = {}) {
        return await model.findByPk(pk, options);
    }

    static async findAndCountAll(model, options = {}) {
        return await model.findAndCountAll(options);
    }

    static async findOrCreate(model, options = {}) {
        return await model.findOrCreate(options);
    }

    static async count(model, options = {}) {
        return await model.count(options);
    }

    static async sum(model, field, options = {}) {
        return await model.sum(field, options);
    }

    static async create(model, data, options = {}) {
        return await model.create(data, options);
    }

    static async update(model, data, options = {}) {
        return await model.update(data, options);
    }

    static async destroy(model, options = {}) {
        return await model.destroy(options);
    }

    static async bulkCreate(model, records, options = {}) {
        return await model.bulkCreate(records, options);
    }

    static async upsert(model, data, options = {}) {
        return await model.upsert(data, options);
    }

    static async increment(target, field, options = {}) {
        // 🔴1 修复: 区分实例调用与模型类调用。
        // Sequelize instance.increment 会忽略传入的 where 条件,仅按主键操作,
        // 导致防负数保护 { praise_times: { [Op.gt]: 0 } } 形同虚设。
        // 这里通过检查 target 是否有 prototype 来判断是模型类还是实例:
        // - 实例调用: instance.increment(field, options)
        // - 模型调用: Model.increment(field, options)  其中 options.where 设置作用行
        if (typeof target === 'function') {
            // 模型类调用 (如 Work.increment)
            return await target.increment(field, options);
        }
        // 🔴1 修复: 当传入实例且 options.where 不为空时,改用模型级 increment。
        // 实例级 instance.increment(field, { where: {...} }) 中的 where 会被忽略,
        // 必须用 Model.increment(field, { where: { id: instance.id, ...where } })
        if (options.where && Object.keys(options.where).length > 0) {
            const model = target.constructor;
            const where = { id: target.id, ...options.where };
            const modelOptions = { ...options, where };
            return await model.increment(field, modelOptions);
        }
        return await target.increment(field, options);
    }

    static async decrement(target, field, options = {}) {
        // 🔴1 修复: 与 increment 同逻辑,区分实例/模型调用,实例带 where 时回退到模型级
        if (typeof target === 'function') {
            return await target.decrement(field, options);
        }
        if (options.where && Object.keys(options.where).length > 0) {
            const model = target.constructor;
            const where = { id: target.id, ...options.where };
            const modelOptions = { ...options, where };
            return await model.decrement(field, modelOptions);
        }
        return await target.decrement(field, options);
    }

    static async save(instance) {
        return await instance.save();
    }

    static getId(instance) {
        return instance.id;
    }
}

module.exports = DbAdapter;
module.exports.parsePagination = parsePagination;
module.exports.PAGINATION_DEFAULTS = PAGINATION_DEFAULTS;
