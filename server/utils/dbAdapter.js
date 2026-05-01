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

    static async increment(instance, field, options = {}) {
        return await instance.increment(field, options);
    }

    static async decrement(instance, field, options = {}) {
        return await instance.decrement(field, options);
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
